import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import { OFFER_TEXTS, todayBerlin, type ItemInput } from "@/lib/billing";
import type { ContractTerms } from "@/lib/contract";
import { check, getBilling } from "./billing";
import { finalize, saveDraft } from "./billing-write";
import { db, sb, type Row } from "./db";
import { sendAppMail } from "./graph-app";
import { createEnvelope, markEnvelopeSent } from "./sign";
import { createMeeting, freeSlots, type Busy, type SlotRules } from "./slots";
import { verifyAltcha } from "./altcha";
import { book as bookErstgespraech, freeSlots as freeErstgespraech, type Slot } from "./booking";

// Pipeline-Automatik: Neuer Lead → Erstgespräch (Lead bucht selbst auf der
// Website, mit oder ohne Einladungslink) → Angebot verschickt (Angebot +
// Agenturvertrag + SEPA-Mandat als Unterschriftsmappe) → Kunde gewonnen (die
// Unterschrift schiebt den Lead) → Onboarding (Aufgaben, Serienrechnung,
// Kick-off-Termin). Einladungslinks liegen nur als SHA-256 in der Datenbank.

export class FlowError extends Error {}

export const WEBSITE_URL = process.env.WEBSITE_URL ?? "https://grid-agency.de";
/** Kalender, in dem Erstgespräche und Kick-offs landen */
const HOST_MAILBOX = process.env.BOOKING_MAILBOX ?? "giulia.cavallino@grid-agency.de";
const HOST_NAME = process.env.BOOKING_NAME ?? "Giulia Cavallino";

export type MeetingKind = "erstgespraech" | "kickoff";

const RULES: Record<MeetingKind, SlotRules> = {
  erstgespraech: { minutes: 30, dayStart: 10, dayEnd: 17, fromTomorrow: true, daysAhead: 21, bufferMinutes: 15 },
  kickoff: { minutes: 60, dayStart: 10, dayEnd: 17, fromTomorrow: true, daysAhead: 21, bufferMinutes: 15 },
};

const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dateTimeDe = (ms: number) =>
  new Date(ms).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

async function note(leadId: string, kind: "system" | "termin" | "email", body: string, author: string | null = null) {
  await db().insert("lead_activities", { lead_id: leadId, kind, body, author });
}

async function leadById(id: string) {
  const lead = await db().get("leads", id);
  if (!lead) throw new FlowError("Lead nicht gefunden");
  return lead;
}

// ---------- Mails ----------

function buttonMail(input: { eyebrow: string; title: string; paragraphs: string[]; button: string; link: string; sender: string }) {
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#2b2926;max-width:520px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px"><tr>
<td style="height:5px;background:#feda75"></td><td style="height:5px;background:#fa7e1e"></td><td style="height:5px;background:#d62976"></td><td style="height:5px;background:#962fbf"></td>
</tr></table>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#fa7e1e;font-weight:600">${escape(input.eyebrow)}</p>
<p style="margin:0 0 20px;font-size:26px;line-height:1.2;font-weight:700">${escape(input.title)}</p>
${input.paragraphs.map((p) => `<p>${escape(p)}</p>`).join("\n")}
<p style="margin:28px 0"><a href="${input.link}" style="display:inline-block;background:#2b2926;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:15px 30px;border-radius:999px;border-bottom:3px solid #fa7e1e">${escape(input.button)} &rarr;</a></p>
<p style="font-size:13px;color:#676159">Oder diesen Link öffnen: <a href="${input.link}" style="color:#676159">${input.link}</a></p>
<p>Viele Grüße<br><strong>${escape(input.sender)}</strong><br>GRID Agency</p>
</div>`;
  return html;
}

// ---------- Einladen zum Erstgespräch ----------

/** Einladung mit persönlichem Buchungslink von hello@; der Lead bleibt in
 * „Neuer Lead“, bis er gebucht hat. Erneut einladen ersetzt den Link. */
export async function inviteLead(id: string, user: { email: string; name: string }) {
  const lead = await leadById(id);
  if (!lead.email) throw new FlowError("Keine E-Mail-Adresse hinterlegt");
  if (lead.meeting_at) throw new FlowError("Das Erstgespräch ist schon gebucht");
  const token = randomBytes(24).toString("base64url");
  const link = `${WEBSITE_URL}/termin?l=${token}`;
  const name = firstName(String(lead.name));
  const html = buttonMail({
    eyebrow: "Einladung zum Erstgespräch",
    title: `Hi ${name}, lass uns sprechen!`,
    paragraphs: [
      `danke für deine Anfrage${lead.company ? ` für ${lead.company}` : ""}! Am besten lernen wir uns kurz kennen: In ${RULES.erstgespraech.minutes} Minuten klären wir, was du vorhast und wie wir dich unterstützen können.`,
      `Such dir einfach einen freien Termin mit ${firstName(HOST_NAME)} aus, die Einladung kommt direkt in deinen Kalender.`,
    ],
    button: "Termin wählen",
    link,
    sender: user.name,
  });
  const updated = await db().update("leads", id, { invite_token_hash: sha256(token), invited_at: new Date().toISOString(), invited_by: user.email });
  if (DEMO) {
    console.info(`[Vorschau] Einladung an ${lead.email}: ${link}`);
  } else {
    await sendAppMail(SHARED_MAILBOX, { to: [String(lead.email)], subject: `${name}, lass uns sprechen – Einladung von GRID`, body: html, html: true }).catch(
      async (error) => {
        await db().update("leads", id, { invite_token_hash: lead.invite_token_hash ?? null, invited_at: lead.invited_at ?? null, invited_by: lead.invited_by ?? null });
        console.error(error);
        throw new FlowError("Mail konnte nicht gesendet werden");
      }
    );
  }
  await note(id, "email", "Zum Erstgespräch eingeladen (Buchungslink)", user.name);
  return updated;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Terminbuchung (Website, mit Einladungslink) ----------

/** Gebuchte Kick-offs, auch wenn Outlook sie noch nicht als belegt meldet */
async function bookedKickoffs(): Promise<Busy[]> {
  const rows = check(await sb().from("leads").select("kickoff_at").gt("kickoff_at", new Date().toISOString())) as { kickoff_at: string }[];
  return rows.map((r) => ({ start: Date.parse(r.kickoff_at), end: Date.parse(r.kickoff_at) + RULES.kickoff.minutes * 60_000 }));
}

async function slotsFor(kind: MeetingKind): Promise<Slot[]> {
  if (kind === "erstgespraech") return freeErstgespraech();
  const minutes = RULES.kickoff.minutes * 60_000;
  return (await freeSlots(HOST_MAILBOX, RULES.kickoff, DEMO ? [] : await bookedKickoffs())).map((ms) => ({
    start: new Date(ms).toISOString(),
    end: new Date(ms + minutes).toISOString(),
  }));
}

async function leadByToken(token: string, kind: MeetingKind) {
  if (!/^[\w-]{20,64}$/.test(token)) throw new FlowError("Dieser Link ist ungültig.");
  if (DEMO) {
    const [lead] = await db().list("leads", { stage: kind === "kickoff" ? "gewonnen" : "neu" });
    return lead;
  }
  const column = kind === "kickoff" ? "kickoff_token_hash" : "invite_token_hash";
  const lead = check(await sb().from("leads").select("*").eq(column, sha256(token)).maybeSingle()) as Row | null;
  if (!lead) throw new FlowError("Dieser Link ist ungültig oder wurde durch eine neue Einladung ersetzt.");
  return lead;
}

export type BookingView = {
  kind: MeetingKind;
  minutes: number;
  prefill: { name: string; email: string; company: string } | null;
  booked: { start: string; url: string | null } | null;
  slots: Slot[];
};

/** Freie Zeiten für einen Einladungslink (Erstgespräch) bzw. den Kick-off */
export async function bookingView(kind: MeetingKind, token: string | null): Promise<BookingView> {
  if (kind === "kickoff" && !token) throw new FlowError("Für den Kick-off brauchst du den Link aus unserer Mail.");
  const lead = token ? await leadByToken(token, kind) : null;
  const at = lead && (kind === "kickoff" ? lead.kickoff_at : lead.meeting_at);
  return {
    kind,
    minutes: RULES[kind].minutes,
    prefill: lead ? { name: String(lead.name ?? ""), email: String(lead.email ?? ""), company: String(lead.company ?? "") } : null,
    booked: at ? { start: String(at), url: ((kind === "kickoff" ? lead.kickoff_url : lead.meeting_url) as string) ?? null } : null,
    slots: at ? [] : await slotsFor(kind),
  };
}

export type BookingInput = { kind: MeetingKind; token: string; start: string; name: string; email: string; company: string; phone: string; message: string };

/** Buchung über einen Einladungslink: Erstgespräch über die Website-Buchung
 * (hello@ als Organisator), Kick-off im Kalender von BOOKING_MAILBOX */
export async function bookWithLink(input: BookingInput) {
  const kind = input.kind === "kickoff" ? "kickoff" : "erstgespraech";
  const lead = await leadByToken(input.token, kind);
  if (kind === "kickoff" ? lead.kickoff_at : lead.meeting_at) throw new FlowError("Du hast schon einen Termin gebucht.");
  const name = input.name.trim().slice(0, 120) || String(lead.name);
  const email = String(lead.email ?? input.email).trim();

  if (kind === "erstgespraech") {
    return bookErstgespraech({ start: input.start, name, email, company: input.company, phone: input.phone, message: input.message }, lead.id);
  }

  const start = Date.parse(input.start);
  const free = await slotsFor("kickoff");
  const slot = free.find((s) => Date.parse(s.start) === start);
  if (!slot) return null;
  const event = await createMeeting(HOST_MAILBOX, {
    subject: `Kick-off GRID × ${lead.company || name}`,
    text: `Hi ${firstName(name)},\n\nwir freuen uns auf den Start! Im Kick-off gehen wir Ziele, Zugänge, Content-Plan und Abläufe durch. Den Teams-Link findest du in diesem Termin.\n\nBis bald\n${HOST_NAME}\nGRID Agency`,
    start,
    minutes: RULES.kickoff.minutes,
    attendee: { email, name },
  });
  await db().update("leads", lead.id, { kickoff_at: slot.start, kickoff_event_id: event.id, kickoff_url: event.joinUrl });
  await note(lead.id, "termin", `Kick-off gebucht: ${dateTimeDe(start)}`, name);
  return { ...slot, url: event.joinUrl };
}

/** Kontaktformular der Website (mit Captcha); der Datenbank-Trigger legt den Lead an */
export async function contact(input: { name: string; email: string; company: string; budget: string; message: string; altcha: string }) {
  await verifyAltcha(input.altcha);
  const name = input.name.trim().slice(0, 120);
  const email = input.email.trim().slice(0, 200);
  const message = input.message.trim().slice(0, 6000);
  if (!name || !EMAIL.test(email) || !message) throw new FlowError("Bitte fülle alle Pflichtfelder aus.");
  if (DEMO) return;
  check(
    await sb()
      .from("contact_submissions")
      .insert({ name, email, company: input.company.trim().slice(0, 160) || null, message, budget: input.budget.trim().slice(0, 40) || null })
  );
}

// ---------- Angebot erstellen und abschicken ----------

export type OfferInput = {
  customer: { name: string; contact_name: string; email: string; street: string; zip: string; city: string };
  title: string;
  intro: string;
  valid_days: number;
  items: Pick<ItemInput, "article_id" | "description" | "quantity" | "unit" | "unit_price_net" | "vat_percent">[];
  terms: ContractTerms;
  sepa_required: boolean;
  signer_name: string;
  signer_email: string;
  grid_signer: string;
  grid_signature: string;
};

const monthly = (unit: string | null | undefined) => !!unit && /monat/i.test(unit);

/** Ein Klick nach dem Erstgespräch: Kunde anlegen, Angebot festschreiben,
 * Mappe (Angebot, Vertrag, SEPA) von hello@ verschicken, Lead weiter */
export async function createOffer(id: string, input: OfferInput, user: { email: string; name: string }) {
  if (DEMO) throw new FlowError("In der Vorschau werden keine Angebote verschickt");
  const lead = await leadById(id);
  const c = input.customer;
  if (!c.name.trim() || !c.street.trim() || !c.zip.trim() || !c.city.trim()) throw new FlowError("Bitte Firma und Anschrift vollständig angeben");
  if (!EMAIL.test(input.signer_email.trim())) throw new FlowError("Bitte eine gültige E-Mail für die Unterschrift angeben");
  const items = input.items.filter((i) => (i.description ?? "").trim() && Number(i.quantity) > 0);
  if (!items.length) throw new FlowError("Bitte mindestens eine Leistung eintragen");

  // Kunde: aus dem Lead anlegen bzw. Anschrift aktualisieren
  const customerData = {
    name: c.name.trim(),
    contact_name: c.contact_name.trim() || null,
    email: c.email.trim() || null,
    billing_email: c.email.trim() || null,
    street: c.street.trim(),
    zip: c.zip.trim(),
    city: c.city.trim(),
    country: "DE",
  };
  const customer = lead.customer_id
    ? await db().update("customers", String(lead.customer_id), customerData)
    : await db().insert("customers", { ...customerData, phone: lead.phone ?? null, source: lead.source, lead_id: lead.id, status: "aktiv" });

  const offerId = await saveDraft(null, {
    kind: "angebot",
    customer_id: customer.id,
    address: { company_name: customerData.name, street: customerData.street, zip_code: customerData.zip, city: customerData.city, country: "DE" },
    recipient_email: input.signer_email.trim(),
    document_date: null,
    payment_terms_days: Math.max(1, Math.min(90, Math.round(input.valid_days) || 14)),
    service_from: input.terms.start_date || null,
    service_to: null,
    title: input.title.trim() || null,
    intro: input.intro.trim() || OFFER_TEXTS.intro,
    closing: OFFER_TEXTS.closing,
    items: items.map((i) => ({
      kind: "position",
      article_id: i.article_id ?? null,
      number: null,
      description: (i.description ?? "").trim(),
      quantity: Number(i.quantity),
      unit: i.unit?.trim() || null,
      unit_price_net: Number(i.unit_price_net),
      vat_percent: Number(i.vat_percent ?? 19),
      discount: null,
      discount_type: null,
    })),
  });
  await finalize(offerId);

  const envelope = await createEnvelope(
    offerId,
    {
      signer_name: input.signer_name.trim(),
      signer_email: input.signer_email.trim(),
      terms: input.terms,
      sepa_required: input.sepa_required,
      grid_signer: input.grid_signer.trim() || user.name,
      grid_signature: input.grid_signature,
    },
    user
  );
  await sendAppMail(SHARED_MAILBOX, { to: [envelope.mail.to], subject: envelope.mail.subject, body: envelope.mail.body });
  await markEnvelopeSent(envelope.id, user.name, envelope.mail.to);

  const value = items.filter((i) => monthly(i.unit)).reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price_net), 0);
  const offer = await getBilling(offerId);
  const updated = await db().update("leads", id, {
    stage: "angebot",
    position: Date.now() / 1000,
    offer_id: offerId,
    customer_id: customer.id,
    ...(value > 0 ? { value: Math.round(value * 100) / 100 } : {}),
  });
  await note(id, "system", `Angebot ${offer?.number ?? ""} mit Vertrag${input.sepa_required ? " und SEPA-Mandat" : ""} zur Unterschrift an ${envelope.mail.to} geschickt`, user.name);
  return updated;
}

// ---------- Automatik aus der Unterschrift ----------

/** Mappe unterschrieben → Lead „Kunde gewonnen“ */
export async function offerSigned(documentId: string, customerId: string | null) {
  const leads = check(await sb().from("leads").select("id,stage").eq("offer_id", documentId)) as { id: string; stage: string }[];
  for (const lead of leads) {
    await db().update("leads", lead.id, {
      stage: "gewonnen",
      status: "offen",
      position: Date.now() / 1000,
      ...(customerId ? { customer_id: customerId } : {}),
    });
    await note(lead.id, "system", "Angebot, Vertrag und SEPA-Mandat unterschrieben – Kunde gewonnen");
  }
}

/** Mappe abgelehnt → Lead verloren (mit Grund) */
export async function offerDeclined(documentId: string, reason: string) {
  const leads = check(await sb().from("leads").select("id").eq("offer_id", documentId)) as { id: string }[];
  for (const lead of leads) {
    await db().update("leads", lead.id, { status: "verloren", lost_reason: `Angebot abgelehnt${reason ? `: ${reason}` : ""}`.slice(0, 500) });
    await note(lead.id, "system", `Angebot abgelehnt${reason ? `: ${reason}` : ""}`);
  }
}

// ---------- Onboarding ----------

const ONBOARDING_TASKS: { title: string; days: number; notes?: string }[] = [
  { title: "Willkommensmail und Ansprechpartner festlegen", days: 0 },
  { title: "Zugänge einsammeln (Instagram, Facebook, TikTok, Google, Meta Business)", days: 2 },
  { title: "Briefing ausfüllen (Zielgruppe, Tonalität, No-Gos, Wettbewerb)", days: 3 },
  { title: "Kick-off durchführen", days: 5, notes: "Termin bucht der Kunde über den Link aus der Onboarding-Mail." },
  { title: "Freigabeprozess und Kommunikationsweg klären", days: 5 },
  { title: "Content-Plan für den ersten Monat", days: 10 },
  { title: "Reporting einrichten", days: 14 },
];

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Erster des nächsten Monats (Berlin) */
function nextMonthStart() {
  const [y, m] = todayBerlin().split("-").map(Number);
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString().slice(0, 10);
}

/** „Onboarding starten“: Aufgabenliste, Serienrechnung aus dem Angebot und
 * Einladung zum Kick-off (Buchungslink) an den Kunden */
export async function startOnboarding(id: string, user: { email: string; name: string }) {
  if (DEMO) throw new FlowError("In der Vorschau startet kein Onboarding");
  const lead = await leadById(id);
  if (lead.stage !== "gewonnen" || !lead.customer_id) throw new FlowError("Erst wenn der Kunde unterschrieben hat");
  if (lead.onboarding_at) throw new FlowError("Das Onboarding läuft schon");
  const customer = await db().get("customers", String(lead.customer_id));
  if (!customer) throw new FlowError("Kunde nicht gefunden");
  const offer = lead.offer_id ? await getBilling(String(lead.offer_id)) : null;
  const envelope = lead.offer_id
    ? (check(
        await sb().from("sign_envelopes").select("contract,signer_name,signer_email").eq("document_id", lead.offer_id).eq("status", "unterschrieben").maybeSingle()
      ) as { contract: { terms: ContractTerms }; signer_name: string; signer_email: string } | null)
    : null;
  const start = envelope?.contract.terms.start_date || offer?.service_from || nextMonthStart();
  const done: string[] = [];

  // 1. Aufgaben: Projekt des Kunden (oder neu) mit Abschnitt „Onboarding“
  let project = (check(await sb().from("task_projects").select("id").eq("customer_id", customer.id).eq("archived", false).limit(1).maybeSingle()) as { id: string } | null) ?? null;
  if (!project) project = (await db().insert("task_projects", { name: String(customer.name), customer_id: customer.id })) as unknown as { id: string };
  const section = check(await sb().from("task_sections").insert({ project_id: project.id, name: "Onboarding" }).select("id").single()) as { id: string };
  const today = todayBerlin();
  check(
    await sb()
      .from("tasks")
      .insert(
        ONBOARDING_TASKS.map((t, i) => ({
          project_id: project.id,
          section_id: section.id,
          title: t.title,
          notes: t.notes ?? null,
          assignee: lead.owner ?? user.email,
          due_on: addDays(today, t.days),
          position: Date.now() / 1000 + i,
        }))
      )
  );
  done.push(`${ONBOARDING_TASKS.length} Onboarding-Aufgaben`);

  // 2. Serienrechnung aus den monatlichen Positionen des Angebots
  if (offer) {
    const positions = offer.items.filter((i) => i.kind === "position");
    const lines = positions.filter((i) => monthly(i.unit));
    if (lines.length) {
      await saveDraft(null, {
        kind: "serie",
        customer_id: customer.id,
        address: offer.address ?? { company_name: String(customer.name) },
        recipient_email: (customer.billing_email as string) ?? (customer.email as string) ?? envelope?.signer_email ?? null,
        document_date: null,
        payment_terms_days: Number(customer.payment_terms_days ?? 5),
        service_from: null,
        service_to: null,
        title: offer.title,
        intro: null,
        closing: null,
        items: lines.map((i) => ({
          kind: "position",
          article_id: i.article_id,
          number: i.number,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unit_price_net: i.unit_price_net,
          vat_percent: i.vat_percent,
          discount: i.discount,
          discount_type: i.discount_type,
        })),
        recurring: { frequency: "MONTHLY", interval: 1, next_date: start, end_date: null, status: "RUNNING" },
      });
      done.push(`Serienrechnung monatlich ab ${new Date(`${start}T12:00:00`).toLocaleDateString("de-DE")}`);
    }
  }

  // 3. Kick-off: Buchungslink an die Person, die unterschrieben hat
  const to = envelope?.signer_email ?? (lead.email as string | null);
  const signer = envelope?.signer_name ?? String(lead.name);
  if (to) {
    const token = randomBytes(24).toString("base64url");
    const link = `${WEBSITE_URL}/termin?l=${token}&art=kickoff`;
    await db().update("leads", id, { kickoff_token_hash: sha256(token) });
    await sendAppMail(SHARED_MAILBOX, {
      to: [to],
      subject: `Willkommen bei GRID – lass uns den Kick-off planen`,
      html: true,
      body: buttonMail({
        eyebrow: "Willkommen bei GRID",
        title: `Hi ${firstName(signer)}, los geht's!`,
        paragraphs: [
          `danke für dein Vertrauen – wir freuen uns riesig auf die Zusammenarbeit mit ${customer.name}!`,
          `Im Kick-off (${RULES.kickoff.minutes} Minuten, per Teams) gehen wir Ziele, Zugänge, Content-Plan und Abläufe durch. Such dir einfach einen Termin aus.`,
        ],
        button: "Kick-off-Termin wählen",
        link,
        sender: user.name,
      }),
    });
    done.push(`Kick-off-Einladung an ${to}`);
  }

  const updated = await db().update("leads", id, { onboarding_at: new Date().toISOString() });
  await note(id, "system", `Onboarding gestartet: ${done.join(", ")}`, user.name);
  return { lead: updated, done };
}
