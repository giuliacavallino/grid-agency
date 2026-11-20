import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DOMAIN, mailboxesFor } from "@/lib/config";
import { berlinDate, fromBerlin } from "@/lib/jourfix";
import { sb } from "./db";
import { appGraph, mailboxPath, type GraphMail } from "./graph-app";

// Verschickte Angebote aus den Sales-Postfächern (giulia@, hello@) in die
// Pipeline übernehmen: Claude liest jede gesendete Mail an Externe einmal.
// Angebot → Lead in „Angebot verschickt“ mit Wert und Nachfass-Termin,
// Nachfass-Mail → Notiz und neuer Termin. Antworten der Leads im Posteingang
// setzen den nächsten Schritt auf „Antwort beantworten“ (noteLeadReply).

type Address = { emailAddress: { name?: string; address?: string } };
type SentMail = {
  id: string;
  internetMessageId: string;
  sentDateTime: string;
  subject: string | null;
  toRecipients?: Address[];
  ccRecipients?: Address[];
  body?: { content: string };
  bodyPreview?: string;
  conversationId?: string;
  hasAttachments?: boolean;
};

type LeadRow = {
  id: string;
  stage: string;
  status: string;
  name: string;
  company: string | null;
  email: string | null;
  value: number | null;
  next_step: string | null;
  next_step_at: string | null;
  owner: string | null;
  raw: Record<string, unknown> | null;
};

export type OfferReading = {
  classification: "angebot" | "nachfassen" | "sonstiges";
  reason: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  /** Monatlicher Betrag netto (Retainer), bei mehreren Varianten die zuletzt angebotene */
  monthly_value: number | null;
  one_time_value: number | null;
  /** Kurze Notiz für die Pipeline: was wurde angeboten bzw. besprochen */
  summary: string;
  /** In der Mail vereinbartes Datum für den nächsten Kontakt (YYYY-MM-DD) */
  follow_up_date: string | null;
};

const SELECT = "id,internetMessageId,sentDateTime,subject,toRecipients,ccRecipients,body,bodyPreview,conversationId,hasAttachments";
const OFFER = /(angebot|offerta|offer|proposal|kostenvoranschlag|\bANG\b|\bX GRID\b|\bGRID X\b|pitch|konditionen|investment|€\s?\d|\d\s?€)/i;
const IGNORE = /(datev|uploadmail|no-?reply|calendar|teams\.microsoft)/i;
const FREEMAIL = /@(gmail|googlemail|yahoo|gmx|web|outlook|hotmail|icloud|t-online|aol|proton|me)\./i;

const lower = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const domainOf = (email: string) => email.split("@")[1] ?? "";
const external = (mail: SentMail) =>
  [...(mail.toRecipients ?? []), ...(mail.ccRecipients ?? [])]
    .map((r) => ({ name: r.emailAddress.name ?? "", email: lower(r.emailAddress.address) }))
    .filter((r) => r.email && !r.email.endsWith(`@${DOMAIN}`) && !IGNORE.test(r.email));

/** Nächster Werktag um 9 Uhr Berliner Zeit, `days` Tage nach dem Zeitpunkt */
export function followUpAt(fromMs: number, days = 7) {
  const [y, m, d] = berlinDate(fromMs + days * 86_400_000).split("-").map(Number);
  let at = fromBerlin(y, m, d, 9);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (weekday === 6) at = fromBerlin(y, m, d + 2, 9);
  if (weekday === 0) at = fromBerlin(y, m, d + 1, 9);
  return new Date(at).toISOString();
}

const dateAt9 = (day: string | null) => {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const at = fromBerlin(y, m, d, 9);
  return at > Date.now() - 86_400_000 ? new Date(at).toISOString() : null;
};

const short = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });

// ---------- Graph ----------

async function listSentSince(mailbox: string, since: Date) {
  const filter = encodeURIComponent(`sentDateTime ge ${since.toISOString()}`);
  let next: string | null = `${mailboxPath(mailbox)}/mailFolders/sentitems/messages?$select=${SELECT}&$filter=${filter}&$orderby=sentDateTime asc&$top=50`;
  const mails: SentMail[] = [];
  while (next && mails.length < 500) {
    const page: { value: SentMail[]; "@odata.nextLink"?: string } = await appGraph(next);
    mails.push(...page.value);
    next = page["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null;
  }
  return mails;
}

async function attachments(mailbox: string, mail: SentMail) {
  if (!mail.hasAttachments) return [];
  const data = await appGraph<{ value: { name: string; isInline: boolean }[] }>(
    `${mailboxPath(mailbox)}/messages/${encodeURIComponent(mail.id)}/attachments?$select=name,isInline`
  ).catch(() => ({ value: [] }));
  return data.value.filter((a) => !a.isInline).map((a) => a.name);
}

// ---------- Claude ----------

const nullable = (type: string) => ({ type: [type, "null"] });
const SCHEMA = {
  type: "object",
  properties: {
    classification: { type: "string", enum: ["angebot", "nachfassen", "sonstiges"] },
    reason: { type: "string" },
    company: nullable("string"),
    contact_name: nullable("string"),
    contact_email: nullable("string"),
    phone: nullable("string"),
    monthly_value: nullable("number"),
    one_time_value: nullable("number"),
    summary: { type: "string" },
    follow_up_date: nullable("string"),
  },
  required: ["classification", "reason", "company", "contact_name", "contact_email", "phone", "monthly_value", "one_time_value", "summary", "follow_up_date"],
  additionalProperties: false,
};

const SYSTEM = `Du liest E-Mails, die GRID (Social-Media-Agentur in Berlin und Frankfurt, Domain ${DOMAIN}) VERSCHICKT hat, und pflegst damit die Sales-Pipeline.

Kategorien:
- "angebot": GRID schickt einem möglichen Neukunden ein Angebot, eine Präsentation mit Preisen oder ein überarbeitetes/abgespecktes Angebot (PDF-Anhang wie „X GRID“/„ANG“ oder Preise im Text). Auch Angebote auf Englisch oder Italienisch.
- "nachfassen": GRID fragt bei einem möglichen Neukunden nach einem offenen Angebot nach, schlägt einen Call vor, beantwortet Rückfragen zum Angebot oder vereinbart den nächsten Kontakt.
- "sonstiges": alles andere – laufende Kundenprojekte, Rechnungen, Mahnungen, Lieferanten, Bewerbungen, Privates, Absagen an Dienstleister, Weiterleitungen an die Buchhaltung.

Felder nur aus der Mail füllen (inkl. zitiertem Verlauf): Firma des Empfängers, Ansprechperson, ihre E-Mail, Telefon. monthly_value = monatlicher Nettobetrag des zuletzt angebotenen Pakets (bei mehreren Varianten die, die GRID zuletzt vorschlägt; bei Phasen die erste Phase), one_time_value = einmalige Kosten (Setup, Strategie) zusammen. follow_up_date = in der Mail genanntes Datum für den nächsten Kontakt oder Call als YYYY-MM-DD (heute ist ${berlinDate(Date.now())}), sonst null. summary: ein bis zwei kurze deutsche Sätze für die Pipeline mit den wichtigsten Zahlen. reason: ein kurzer deutscher Satz.`;

let client: Anthropic | null = null;

export async function readSentMail(input: { subject: string; to: string; body: string; attachments: string[]; knownLead: string | null }): Promise<OfferReading | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `An: ${input.to}`,
          `Betreff: ${input.subject}`,
          `Anhänge: ${input.attachments.length ? input.attachments.join(", ") : "keine"}`,
          input.knownLead ? `Bekannter Lead in der Pipeline: ${input.knownLead}` : "Empfänger ist noch kein Lead in der Pipeline.",
          "",
          input.body.slice(0, 14_000),
        ].join("\n"),
      },
    ],
  });
  const text = response.content.find((block) => block.type === "text");
  if (response.stop_reason === "refusal" || !text || text.type !== "text") return null;
  return JSON.parse(text.text) as OfferReading;
}

// ---------- Pipeline ----------

async function findLead(recipients: { email: string }[], company: string | null): Promise<LeadRow | null> {
  const emails = recipients.map((r) => r.email);
  const { data } = await sb().from("leads").select("id,stage,status,name,company,email,value,next_step,next_step_at,owner,raw").not("email", "is", null).order("updated_at", { ascending: false }).limit(2000);
  const leads = (data ?? []) as LeadRow[];
  const exact = leads.find((l) => emails.includes(lower(l.email)));
  if (exact) return exact;
  const domains = emails.filter((e) => !FREEMAIL.test(e)).map(domainOf);
  const sameDomain = leads.find((l) => l.email && !FREEMAIL.test(l.email) && domains.includes(domainOf(lower(l.email))));
  if (sameDomain) return sameDomain;
  const name = lower(company);
  if (name.length >= 4) return leads.find((l) => lower(l.company).includes(name) || (lower(l.company).length >= 4 && name.includes(lower(l.company)))) ?? null;
  return null;
}

async function note(leadId: string, author: string, body: string, at: string) {
  await sb().from("lead_activities").insert({ lead_id: leadId, kind: "email", author, body, created_at: at });
}

const OPEN_STAGES = new Set(["neu", "eingeladen", "erstgespraech", "angebot"]);

/** Eine gesendete Mail verarbeiten (einmal je Mail) */
async function processSent(mailbox: string, mail: SentMail) {
  const key = mail.internetMessageId || mail.id;
  const { data: known } = await sb().from("outbound_messages").select("id").eq("id", key).maybeSingle();
  if (known) return "bekannt";

  const recipients = external(mail);
  const subject = mail.subject ?? "";
  const body = (mail.body?.content ?? mail.bodyPreview ?? "").trim();
  const log = async (classification: OfferReading["classification"], reason: string, leadId: string | null = null) => {
    await sb().from("outbound_messages").upsert(
      { id: key, mailbox, graph_id: mail.id, sent_at: mail.sentDateTime, to_email: recipients[0]?.email ?? null, subject, classification, reason, lead_id: leadId },
      { onConflict: "id", ignoreDuplicates: true }
    );
    return classification;
  };
  if (!recipients.length) return log("sonstiges", "Keine externen Empfänger");

  const lead = await findLead(recipients, null);
  const files = await attachments(mailbox, mail);
  const pdf = files.some((f) => /\.pdf$/i.test(f));
  // Ohne Angebotsbezug und ohne bekannten Lead gar nicht erst lesen
  if (!lead && !OFFER.test(`${subject}\n${body.slice(0, 4000)}\n${files.join(" ")}`) && !pdf) return log("sonstiges", "Kein Angebotsbezug (Regel)");
  if (lead?.stage === "gewonnen") return log("sonstiges", "Lead ist bereits Kunde", lead.id);

  const reading = await readSentMail({
    subject,
    to: recipients.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)).join(", "),
    body,
    attachments: files,
    knownLead: lead ? [lead.company, lead.name, lead.stage === "angebot" ? "Angebot verschickt" : lead.stage].filter(Boolean).join(" · ") : null,
  });
  if (!reading) return "uebersprungen"; // ohne Claude später erneut versuchen
  if (reading.classification === "sonstiges") return log("sonstiges", reading.reason, lead?.id ?? null);

  const sentMs = Date.parse(mail.sentDateTime);
  const nextAt = dateAt9(reading.follow_up_date) ?? followUpAt(sentMs);
  const author = mailbox;
  const label = reading.classification === "angebot" ? "Angebot verschickt" : "Nachgefasst";
  const text = [`${label} am ${short(mail.sentDateTime)}: ${subject}`, reading.summary].filter(Boolean).join("\n");

  let target = lead ?? (reading.classification === "angebot" ? await findLead(recipients, reading.company) : null);
  if (!target && reading.classification === "nachfassen") return log("sonstiges", `Nachfassen ohne Lead: ${reading.reason}`);

  if (!target) {
    const contact = recipients.find((r) => r.email === lower(reading.contact_email)) ?? recipients[0];
    const { data, error } = await sb()
      .from("leads")
      .insert({
        source: "email",
        source_ref: `sent:${key}`,
        stage: "angebot",
        name: reading.contact_name || contact.name || contact.email,
        company: reading.company,
        email: lower(reading.contact_email) || contact.email,
        phone: reading.phone,
        value: reading.monthly_value,
        owner: mailbox.startsWith("hello@") ? null : mailbox,
        next_step: "Nachfassen: Angebot",
        next_step_at: nextAt,
        message: text,
        created_at: mail.sentDateTime,
        raw: { auto: "angebot-mail", conversation_id: mail.conversationId, one_time_value: reading.one_time_value },
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Lead nicht angelegt");
    await note(data.id, author, text, mail.sentDateTime);
    return log("angebot", reading.reason, data.id);
  }

  const patch: Record<string, unknown> = {};
  if (reading.classification === "angebot") {
    if (OPEN_STAGES.has(target.stage)) patch.stage = "angebot";
    if (target.status === "verloren") patch.status = "offen";
    if (reading.monthly_value) patch.value = reading.monthly_value;
    patch.next_step = `Nachfassen: Angebot vom ${short(mail.sentDateTime)}`;
    patch.next_step_at = nextAt;
  } else {
    // Vereinbartes Datum übernehmen; sonst nur verschieben, wenn kein späterer Termin steht
    const planned = target.next_step_at ? Date.parse(target.next_step_at) : 0;
    if (reading.follow_up_date || planned < Date.parse(nextAt)) {
      patch.next_step_at = nextAt;
      patch.next_step = target.next_step && !/^Antwort von/.test(target.next_step) ? target.next_step : "Nachfassen";
    }
  }
  if (!target.owner && !mailbox.startsWith("hello@")) patch.owner = mailbox;
  if (Object.keys(patch).length) await sb().from("leads").update(patch).eq("id", target.id);
  await note(target.id, author, text, mail.sentDateTime);
  target = { ...target, ...patch } as LeadRow;
  return log(reading.classification, reading.reason, target.id);
}

/** Gesendete Mails der Sales-Postfächer seit `since` abgleichen */
export async function syncSentOffers(since: Date) {
  const result: Record<string, Record<string, number> | { error: string }> = {};
  for (const mailbox of mailboxesFor("sales")) {
    try {
      const counts: Record<string, number> = {};
      for (const mail of await listSentSince(mailbox, since)) {
        const outcome = await processSent(mailbox, mail).catch((error) => {
          console.error("Gesendete Mail nicht verarbeitet:", error);
          return "fehler";
        });
        counts[outcome] = (counts[outcome] ?? 0) + 1;
      }
      result[mailbox] = counts;
    } catch (error) {
      result[mailbox] = { error: (error as Error).message };
    }
  }
  return result;
}

/** Antwort eines offenen Leads im Posteingang: Notiz und „Antwort beantworten“ als nächster Schritt */
export async function noteLeadReply(mail: GraphMail) {
  const from = lower(mail.from?.emailAddress.address);
  if (!from || from.endsWith(`@${DOMAIN}`)) return;
  const { data } = await sb().from("leads").select("id,stage,status,name,company,next_step_at").eq("status", "offen").ilike("email", from).limit(1);
  const lead = data?.[0] as (Pick<LeadRow, "id" | "stage" | "status" | "name" | "company" | "next_step_at">) | undefined;
  if (!lead || lead.stage === "gewonnen") return;
  const name = mail.from?.emailAddress.name || lead.name;
  const preview = (mail.bodyPreview ?? mail.body?.content ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  await note(lead.id, mail.mailbox, [`Antwort am ${short(mail.receivedDateTime)}: ${mail.subject ?? ""}`, preview].filter(Boolean).join("\n"), mail.receivedDateTime);
  await sb().from("leads").update({ next_step: `Antwort von ${name} beantworten`, next_step_at: mail.receivedDateTime }).eq("id", lead.id);
}
