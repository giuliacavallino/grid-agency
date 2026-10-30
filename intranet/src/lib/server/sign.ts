import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import {
  DEFAULT_PURPOSE,
  fillContract,
  formatIban,
  formatVerifyId,
  SIGN_FIELD_LABEL,
  signFields,
  validIban,
  VERIFY_ID,
  type ContractSnapshot,
  type ContractTerms,
  type SignField,
} from "@/lib/contract";
import { KIND_LABEL, plain, type BillingDetail } from "@/lib/billing";
import { BUCKET, billingSettings, check, contractTemplate, getBilling } from "./billing";
import { PART_FILE, renderBundle, renderPart, type AuditEvent, type BundleInput, type BundlePart, type SepaData } from "./bundle-pdf";
import { sb } from "./db";
import { sendAppMail } from "./graph-app";
import { brandedMail, senderFor } from "./mail-template";
import { sealFingerprint, sealPdf } from "./seal";

// Unterschriftsmappe: Angebot + Agenturvertrag + SEPA-Mandat. GRID
// unterschreibt beim Versand, der Kunde auf sign.grid-agency.de über einen
// geheimen Link (nur dessen SHA-256 liegt in der Datenbank). Nach der
// Unterschrift wird die Mappe mit Abschlussprotokoll versiegelt, in der
// Kundenakte abgelegt und an beide Seiten gemailt.

export class SignError extends Error {}

export const SIGN_URL = process.env.SIGN_URL ?? "https://sign.grid-agency.de";

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

type EnvelopeRow = {
  id: string;
  created_at: string;
  document_id: string;
  customer_id: string | null;
  status: "versendet" | "geoeffnet" | "unterschrieben" | "abgelehnt" | "widerrufen";
  signer_name: string;
  signer_email: string;
  contract: ContractSnapshot;
  sepa_required: boolean;
  mandate_reference: string | null;
  grid_signer: string;
  grid_signature: string;
  grid_signed_at: string;
  customer_signature: string | null;
  customer_signed_at: string | null;
  sepa: SepaData | null;
  decline_reason: string | null;
  audit: AuditEvent[];
  unsigned_hash: string | null;
  signed_hash: string | null;
  pdf_path: string | null;
  sent_by: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string;
  mail_error: string | null;
};

/** Ohne Unterschriftsbilder und Vertrag (für Listen im Intranet) */
export type EnvelopeSummary = Pick<
  EnvelopeRow,
  | "id"
  | "created_at"
  | "status"
  | "signer_name"
  | "signer_email"
  | "sepa_required"
  | "mandate_reference"
  | "grid_signer"
  | "customer_signed_at"
  | "decline_reason"
  | "audit"
  | "sent_at"
  | "viewed_at"
  | "expires_at"
  | "mail_error"
> & { has_pdf: boolean };

const SUMMARY_COLUMNS =
  "id,created_at,status,signer_name,signer_email,sepa_required,mandate_reference,grid_signer,customer_signed_at,decline_reason,audit,sent_at,viewed_at,expires_at,mail_error,pdf_path";

const isPng = (value: unknown): value is string => typeof value === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 400_000;
const isEmail = (value: unknown): value is string => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

export { contractTemplate } from "./billing";

/** Prüf-ID der GRID-Unterschrift, aus der Mappe abgeleitet */
const gridVerifyId = (id: string) => formatVerifyId(sha256(`${id}:grid`));

/** Prüf-IDs der Kundenunterschriften stehen im Protokoll */
const fieldIds = (audit: AuditEvent[]) =>
  Object.fromEntries(audit.filter((e) => e.event === "feld" && e.field && e.ref).map((e) => [e.field, e.ref])) as Partial<Record<SignField, string>>;

async function bundleInput(row: EnvelopeRow, offer: BillingDetail, final = false): Promise<BundleInput> {
  return {
    grid_id: gridVerifyId(row.id),
    field_ids: fieldIds(row.audit),
    id: row.id,
    offer,
    settings: await billingSettings(),
    contract: row.contract,
    signer_name: row.signer_name,
    signer_email: row.signer_email,
    sepa_required: row.sepa_required,
    mandate_reference: row.mandate_reference,
    grid_signer: row.grid_signer,
    grid_signature: row.grid_signature,
    grid_signed_at: row.grid_signed_at,
    customer_signature: row.customer_signature,
    customer_signed_at: row.customer_signed_at,
    sepa: row.sepa,
    audit: row.audit,
    unsigned_hash: row.unsigned_hash,
    final,
    seal_fingerprint: final ? await sealFingerprint() : null,
  };
}

async function offerOf(row: Pick<EnvelopeRow, "document_id">) {
  const offer = await getBilling(row.document_id);
  if (!offer) throw new SignError("Angebot nicht gefunden");
  return offer;
}

// ---------- Intranet ----------

export type CreateInput = {
  signer_name: string;
  signer_email: string;
  terms: ContractTerms;
  sepa_required: boolean;
  grid_signer: string;
  grid_signature: string;
};

/** Mappe anlegen; der Link wird nur hier einmal zurückgegeben */
export async function createEnvelope(offerId: string, input: CreateInput, user: { name: string; email: string }) {
  if (DEMO) throw new SignError("In der Vorschau können keine Mappen verschickt werden");
  const offer = await getBilling(offerId);
  if (!offer || offer.kind !== "angebot") throw new SignError("Angebot nicht gefunden");
  if (!offer.number || offer.status === "entwurf") throw new SignError("Bitte das Angebot zuerst fertigstellen");
  if (offer.status === "angenommen") throw new SignError("Das Angebot ist bereits angenommen");
  if (!input.signer_name?.trim() || !isEmail(input.signer_email)) throw new SignError("Name und E-Mail der unterschreibenden Person fehlen");
  if (!isPng(input.grid_signature)) throw new SignError("Bitte für GRID unterschreiben");
  const start = isoDate(input.terms?.start_date);
  const min = Math.round(Number(input.terms?.min_term_months));
  const notice = Math.round(Number(input.terms?.notice_months));
  if (!start || !(min >= 0 && min <= 60) || !(notice >= 0 && notice <= 24)) throw new SignError("Vertragsbeginn, Mindestlaufzeit oder Kündigungsfrist fehlen");
  if (input.sepa_required && !(await billingSettings()).company.creditor_id) {
    throw new SignError("Für das SEPA-Mandat fehlt die Gläubiger-ID in Finance → Einstellungen");
  }

  // Offene Mappen zu diesem Angebot ziehen wir zurück
  check(await sb().from("sign_envelopes").update({ status: "widerrufen" }).eq("document_id", offerId).in("status", ["versendet", "geoeffnet"]));

  const template = await contractTemplate();
  const token = randomBytes(32).toString("base64url");
  const now = new Date().toISOString();
  const row = check(
    await sb()
      .from("sign_envelopes")
      .insert({
        document_id: offerId,
        customer_id: offer.customer_id,
        token_hash: sha256(token),
        signer_name: input.signer_name.trim(),
        signer_email: input.signer_email.trim().toLowerCase(),
        contract: {
          ...template,
          terms: {
            purpose: input.terms.purpose?.trim() || "",
            start_date: start,
            min_term_months: min,
            notice_months: notice,
            once_billing: input.terms.once_billing === "unterschrift" || isoDate(input.terms.once_billing) ? input.terms.once_billing : "vertragsbeginn",
          },
        },
        sepa_required: !!input.sepa_required,
        grid_signer: input.grid_signer?.trim() || user.name,
        grid_signature: input.grid_signature,
        grid_signed_at: now,
        audit: [{ at: now, event: "erstellt", by: input.grid_signer?.trim() || user.name, detail: user.email }],
      })
      .select("*")
      .single()
  ) as EnvelopeRow;

  // Prüfsumme der Mappe, wie der Kunde sie zu sehen bekommt
  const unsigned = await renderBundle(await bundleInput(row, offer));
  check(await sb().from("sign_envelopes").update({ unsigned_hash: sha256(unsigned) }).eq("id", row.id));

  const settings = await billingSettings();
  const link = `${SIGN_URL}/s/${token}`;
  return {
    id: row.id,
    link,
    mail: {
      from: SHARED_MAILBOX,
      to: row.signer_email,
      subject: `Ihr Angebot von ${settings.company.name}`,
      html: true,
      // Kein Preis in der Mail: alles steht im Angebot hinter dem Button
      body: brandedMail({
        eyebrow: "Ihr Angebot",
        title: `Hallo ${input.signer_name.trim().split(/\s+/)[0]}, Ihr Angebot ist da!`,
        paragraphs: [
          "vielen Dank für das gute Gespräch. Wie besprochen haben wir Ihnen alles zusammengestellt.",
          `Mit einem Klick sehen Sie das Angebot ein. Passt alles, nehmen Sie es direkt online an und unterschreiben in einem Schritt den Agenturvertrag${row.sepa_required ? " und das SEPA-Lastschriftmandat" : ""}.`,
        ],
        button: { label: "Angebot einsehen", href: link },
        note: `Der Link gilt bis zum ${new Date(row.expires_at).toLocaleDateString("de-DE")}. Fragen? Antworten Sie einfach auf diese Mail.`,
        sender: senderFor(row.grid_signer, user.email),
      }),
    },
  };
}

async function appendAudit(id: string, events: AuditEvent[], patch: Record<string, unknown> = {}) {
  const row = check(await sb().from("sign_envelopes").select("audit").eq("id", id).single()) as { audit: AuditEvent[] };
  check(await sb().from("sign_envelopes").update({ ...patch, audit: [...row.audit, ...events] }).eq("id", id));
}

export async function markEnvelopeSent(id: string, by: string, to: string) {
  const now = new Date().toISOString();
  await appendAudit(id, [{ at: now, event: "versendet", by, detail: `an ${to}` }], { sent_at: now, sent_by: by });
}

export async function revokeEnvelope(id: string, by: string) {
  const row = check(await sb().from("sign_envelopes").select("status").eq("id", id).single()) as { status: string };
  if (!["versendet", "geoeffnet"].includes(row.status)) throw new SignError("Nur offene Mappen lassen sich zurückziehen");
  await appendAudit(id, [{ at: new Date().toISOString(), event: "widerrufen", by }], { status: "widerrufen" });
}

export async function listEnvelopes(documentId: string): Promise<EnvelopeSummary[]> {
  if (DEMO) return [];
  const rows = check(await sb().from("sign_envelopes").select(SUMMARY_COLUMNS).eq("document_id", documentId).order("created_at", { ascending: false })) as unknown as (EnvelopeSummary & {
    pdf_path: string | null;
  })[];
  return rows.map(({ pdf_path, ...row }) => ({ ...row, has_pdf: !!pdf_path }));
}

export async function envelopePdfUrl(id: string) {
  const row = check(await sb().from("sign_envelopes").select("pdf_path").eq("id", id).single()) as { pdf_path: string | null };
  if (!row.pdf_path) throw new SignError("Noch nicht unterschrieben");
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(row.pdf_path, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Vorschau der Mappe vor dem Versand (ohne Speichern) */
export async function previewBundle(offerId: string, input: CreateInput) {
  const offer = await getBilling(offerId);
  if (!offer) throw new SignError("Angebot nicht gefunden");
  const template = await contractTemplate();
  const now = new Date().toISOString();
  const row = {
    id: "00000000-vorschau",
    contract: { ...template, terms: { ...input.terms, purpose: input.terms.purpose ?? "" } },
    signer_name: input.signer_name || "Name",
    signer_email: input.signer_email || "",
    sepa_required: !!input.sepa_required,
    mandate_reference: null,
    grid_signer: input.grid_signer,
    grid_signature: isPng(input.grid_signature) ? input.grid_signature : TRANSPARENT_PNG,
    grid_signed_at: now,
    customer_signature: null,
    customer_signed_at: null,
    sepa: null,
    audit: [],
    unsigned_hash: null,
  } as unknown as EnvelopeRow;
  return renderBundle(await bundleInput(row, offer));
}

const TRANSPARENT_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// ---------- Öffentlich (sign.grid-agency.de) ----------

export type Client = { ip: string; ua: string };

async function byToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new SignError("Link ungültig");
  const row = check(await sb().from("sign_envelopes").select("*").eq("token_hash", sha256(token)).maybeSingle()) as EnvelopeRow | null;
  if (!row) throw new SignError("Link ungültig");
  return row;
}

const expired = (row: EnvelopeRow) => new Date(row.expires_at) < new Date() && (row.status === "versendet" || row.status === "geoeffnet");

/** Mappe für die lokale Vorschau (NEXT_PUBLIC_INTRANET_DEMO=1) */
async function demoRow(): Promise<EnvelopeRow> {
  const template = await contractTemplate();
  return {
    id: "00000000-0000-4000-8000-000000000000",
    created_at: new Date().toISOString(),
    document_id: "beleg-9",
    customer_id: null,
    status: "geoeffnet",
    signer_name: "Marco Rossi",
    signer_email: "marco@casabeef.de",
    contract: { ...template, terms: { purpose: DEFAULT_PURPOSE, start_date: "2026-12-01", min_term_months: 3, notice_months: 1 } },
    sepa_required: true,
    mandate_reference: null,
    grid_signer: "Giulia Cavallino",
    grid_signature: TRANSPARENT_PNG,
    grid_signed_at: new Date().toISOString(),
    customer_signature: null,
    customer_signed_at: null,
    sepa: null,
    decline_reason: null,
    audit: [],
    unsigned_hash: null,
    signed_hash: null,
    pdf_path: null,
    sent_by: null,
    sent_at: null,
    viewed_at: null,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    mail_error: null,
  };
}

/** Was die Unterschriftsseite zeigt (ohne Unterschriftsbilder) */
export async function publicView(token: string, client: Client) {
  const row = DEMO ? await demoRow() : await byToken(token);
  const offer = await offerOf(row);
  const settings = await billingSettings();
  if (row.status === "versendet" && !expired(row)) {
    const now = new Date().toISOString();
    await appendAudit(row.id, [{ at: now, event: "geoeffnet", ...client }], { status: "geoeffnet", viewed_at: now });
    row.status = "geoeffnet";
  }
  const fill = (text: string) => fillContract(text, { terms: row.contract.terms, offerNumber: offer.number, offerDate: offer.document_date });
  return {
    status: expired(row) ? ("abgelaufen" as const) : row.status,
    company: {
      name: settings.company.name,
      street: settings.company.street,
      zip: settings.company.zip,
      city: settings.company.city,
      email: settings.company.email,
      creditor_id: settings.company.creditor_id,
      managing_director: settings.company.managing_director.replace(/^(Frau|Herr)\s+/, ""),
    },
    signer_name: row.signer_name,
    signer_email: row.signer_email,
    grid_signer: row.grid_signer,
    grid_signature: row.grid_signature,
    grid_id: gridVerifyId(row.id),
    grid_signed_at: row.grid_signed_at,
    customer_signed_at: row.customer_signed_at,
    expires_at: row.expires_at,
    sepa_required: row.sepa_required,
    customer: {
      name: offer.address?.company_name || offer.customer_name || "",
      street: offer.address?.street ?? "",
      zip: offer.address?.zip_code ?? "",
      city: offer.address?.city ?? "",
    },
    offer: {
      label: `${KIND_LABEL[offer.kind]} ${offer.number}`,
      number: offer.number,
      date: offer.document_date,
      valid_until: offer.due_date,
      intro: plain(offer.intro),
      currency: offer.currency,
      amount_net: offer.amount_net,
      amount_vat: offer.amount_vat,
      amount_gross: offer.amount_gross,
      items: offer.items.map((i) => ({ kind: i.kind, description: plain(i.description), quantity: i.quantity, unit: i.unit, unit_price_net: i.unit_price_net, total_net: i.total_net })),
    },
    contract: { title: row.contract.title, sections: row.contract.sections.map((sec) => ({ heading: sec.heading, body: fill(sec.body) })) },
  };
}

/** PDF für die Unterschriftsseite: vorher die Mappe, danach die versiegelte */
export async function publicPdf(token: string) {
  if (DEMO) {
    const row = await demoRow();
    return { bytes: await renderBundle(await bundleInput(row, await offerOf(row))), name: "Unterlagen.pdf" };
  }
  const row = await byToken(token);
  if (row.pdf_path) {
    const { data, error } = await sb().storage.from(BUCKET).download(row.pdf_path);
    if (error) throw new Error(error.message);
    return { bytes: Buffer.from(await data.arrayBuffer()), name: "Unterlagen_unterschrieben.pdf" };
  }
  if (row.status === "widerrufen") throw new SignError("Diese Mappe wurde zurückgezogen");
  return { bytes: await renderBundle(await bundleInput(row, await offerOf(row))), name: "Unterlagen.pdf" };
}

/** Kunde bestätigt das Angebot und geht zur Unterschrift der Mappe */
export async function acceptOffer(token: string, client: Client) {
  if (DEMO) return;
  const row = await byToken(token);
  if (!["versendet", "geoeffnet"].includes(row.status) || expired(row)) throw new SignError("Die Mappe ist nicht mehr offen");
  if (row.audit.some((e) => e.event === "angenommen")) return;
  await appendAudit(row.id, [{ at: new Date().toISOString(), event: "angenommen", by: row.signer_name, ...client }]);
}

export async function decline(token: string, reason: string, client: Client) {
  if (DEMO) return;
  const row = await byToken(token);
  if (!["versendet", "geoeffnet"].includes(row.status) || expired(row)) throw new SignError("Die Mappe ist nicht mehr offen");
  await appendAudit(row.id, [{ at: new Date().toISOString(), event: "abgelehnt", by: row.signer_name, detail: reason.slice(0, 500), ...client }], {
    status: "abgelehnt",
    decline_reason: reason.slice(0, 500) || null,
  });
  check(await sb().from("billing_documents").update({ status: "abgelehnt" }).eq("id", row.document_id).eq("status", "offen"));
  await import("./lead-flow").then((flow) => flow.offerDeclined(row.document_id, reason.slice(0, 500))).catch(console.error);
}

export type SignInput = { consent: boolean; signature: string; sepa?: SepaData | null; fields?: Partial<Record<SignField, string>> };

export async function signEnvelope(token: string, input: SignInput, client: Client) {
  if (DEMO) return { signed_at: new Date().toISOString() };
  const row = await byToken(token);
  if (row.status === "unterschrieben") throw new SignError("Die Unterlagen sind bereits unterschrieben");
  if (!["versendet", "geoeffnet"].includes(row.status)) throw new SignError("Diese Mappe ist nicht mehr offen");
  if (expired(row)) throw new SignError("Der Link ist abgelaufen. Bitte fordern Sie einen neuen an.");
  if (!input.consent) throw new SignError("Bitte der elektronischen Unterschrift zustimmen");
  if (!isPng(input.signature)) throw new SignError("Bitte unterschreiben");
  const fields = signFields(row.sepa_required);
  const ids = fields.map((f) => input.fields?.[f]);
  if (ids.some((id) => !id || !VERIFY_ID.test(id))) throw new SignError("Bitte an allen markierten Stellen unterschreiben");
  if (new Set(ids).size !== ids.length) throw new SignError("Prüf-IDs sind nicht eindeutig");

  let sepa: SepaData | null = null;
  if (row.sepa_required) {
    const s = input.sepa;
    if (!s?.holder?.trim()) throw new SignError("Bitte den Kontoinhaber angeben");
    if (!s.iban || !validIban(s.iban)) throw new SignError("Die IBAN ist ungültig");
    sepa = {
      holder: s.holder.trim().slice(0, 140),
      iban: s.iban.replace(/\s+/g, "").toUpperCase(),
      bic: s.bic?.replace(/\s+/g, "").toUpperCase().slice(0, 11) || undefined,
      bank: s.bank?.trim().slice(0, 140) || undefined,
      street: s.street?.trim().slice(0, 140) || undefined,
      zip: s.zip?.trim().slice(0, 10) || undefined,
      city: s.city?.trim().slice(0, 80) || undefined,
    };
  }

  const offer = await offerOf(row);
  const customer = row.customer_id
    ? (check(await sb().from("customers").select("id,customer_number").eq("id", row.customer_id).maybeSingle()) as { id: string; customer_number: string | null } | null)
    : null;
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const mandate = row.sepa_required ? `GRID-${customer?.customer_number || row.customer_id?.slice(0, 8).toUpperCase() || "KUNDE"}-${stamp}` : null;
  const events: AuditEvent[] = [
    { at: now.toISOString(), event: "zugestimmt", ...client },
    ...fields.map((field, i) => ({ at: now.toISOString(), event: "feld", field, ref: ids[i], by: row.signer_name, detail: SIGN_FIELD_LABEL[field], ...client })),
    { at: now.toISOString(), event: "unterschrieben", by: row.signer_name, detail: row.signer_email, ...client },
  ];

  // Versiegeln und ablegen
  const signed: EnvelopeRow = {
    ...row,
    status: "unterschrieben",
    customer_signature: input.signature,
    customer_signed_at: now.toISOString(),
    sepa,
    mandate_reference: mandate,
    audit: [...row.audit, ...events],
  };
  const finalInput = await bundleInput(signed, offer, true);
  const pdf = await sealPdf(await renderBundle(finalInput), {
    reason: `Angebot ${offer.number}, ${row.contract.title}${row.sepa_required ? ", SEPA-Mandat" : ""} – unterschrieben von ${row.signer_name}`,
  });
  const folder = row.customer_id ?? "ohne-kunde";
  const path = `kunden/${folder}/${stamp}_Angebot-${offer.number}_unterschrieben_${row.id.slice(0, 8)}.pdf`;
  check(await sb().storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: false }));

  // Jedes Dokument zusätzlich einzeln (Abschlussmail, Kundenakte), je mit Siegel
  const parts: BundlePart[] = row.sepa_required ? ["angebot", "vertrag", "sepa"] : ["angebot", "vertrag"];
  const files: { part: BundlePart; name: string; path: string; bytes: Buffer }[] = [];
  for (const part of parts) {
    const bytes = await sealPdf(await renderPart(finalInput, part), {
      reason: `${PART_FILE[part]} zu Angebot ${offer.number} – unterschrieben von ${row.signer_name}`,
    });
    const name = `${PART_FILE[part]}_${offer.number}_unterschrieben.pdf`;
    const partPath = `kunden/${folder}/${stamp}_${PART_FILE[part]}-${offer.number}_unterschrieben_${row.id.slice(0, 8)}.pdf`;
    check(await sb().storage.from(BUCKET).upload(partPath, bytes, { contentType: "application/pdf", upsert: false }));
    files.push({ part, name, path: partPath, bytes });
  }

  check(
    await sb()
      .from("sign_envelopes")
      .update({
        status: "unterschrieben",
        customer_signature: input.signature,
        customer_signed_at: now.toISOString(),
        sepa,
        mandate_reference: mandate,
        audit: [...signed.audit, { at: new Date().toISOString(), event: "versiegelt" }],
        signed_hash: sha256(pdf),
        pdf_path: path,
      })
      .eq("id", row.id)
      .in("status", ["versendet", "geoeffnet"])
  );
  check(await sb().from("billing_documents").update({ status: "angenommen" }).eq("id", row.document_id));
  // Pipeline: Lead auf „Kunde gewonnen“ (Fehler halten die Unterschrift nicht auf)
  await import("./lead-flow").then((flow) => flow.offerSigned(row.document_id, row.customer_id)).catch(console.error);
  if (row.customer_id) {
    const label: Record<BundlePart, string> = { angebot: `Angebot ${offer.number}`, vertrag: row.contract.title, sepa: "SEPA-Lastschriftmandat" };
    check(
      await sb()
        .from("customer_documents")
        .insert([
          ...files.map((f) => ({
            customer_id: row.customer_id,
            kind: f.part,
            title: `${label[f.part]} (unterschrieben)`,
            pdf_path: f.path,
            envelope_id: row.id,
            document_id: row.document_id,
          })),
          {
            customer_id: row.customer_id,
            kind: "sonstiges",
            title: `Gesamte Mappe zu Angebot ${offer.number} (unterschrieben)`,
            pdf_path: path,
            envelope_id: row.id,
            document_id: row.document_id,
          },
        ])
    );
    if (sepa) {
      check(
        await sb()
          .from("customers")
          .update({ sepa_mandate_reference: mandate, sepa_holder: sepa.holder, sepa_iban: sepa.iban, sepa_bic: sepa.bic ?? null, sepa_signed_at: now.toISOString() })
          .eq("id", row.customer_id)
      );
    }
  }

  // Abschlussmail an beide Seiten; scheitert sie, bleibt die Unterschrift gültig
  await sendCompletion(row, offer, files, mandate, sepa).catch(async (error) => {
    await sb()
      .from("sign_envelopes")
      .update({ mail_error: String(error instanceof Error ? error.message : error).slice(0, 500) })
      .eq("id", row.id);
  });
  return { signed_at: now.toISOString() };
}

async function sendCompletion(row: EnvelopeRow, offer: BillingDetail, files: { name: string; bytes: Buffer }[], mandate: string | null, sepa: SepaData | null) {
  const settings = await billingSettings();
  // Jedes Dokument als eigene PDF: Angebot, Vertrag, SEPA-Mandat
  const attachments = files.map((f) => ({ name: f.name, contentType: "application/pdf", contentBytes: f.bytes.toString("base64") }));
  const first = row.signer_name.trim().split(/\s+/)[0];
  await sendAppMail(SHARED_MAILBOX, {
    to: [row.signer_email],
    subject: `Willkommen bei GRID – Ihre unterschriebenen Unterlagen`,
    html: true,
    body: brandedMail({
      eyebrow: "Unterschrieben und versiegelt",
      title: `Willkommen bei GRID, ${first}!`,
      paragraphs: [
        `vielen Dank für Ihr Vertrauen! Angebot ${offer.number}, ${row.contract.title}${row.sepa_required ? " und SEPA-Lastschriftmandat" : ""} sind jetzt von beiden Seiten unterschrieben.`,
        "Im Anhang finden Sie jedes Dokument als eigene, versiegelte PDF für Ihre Unterlagen.",
        ...(mandate && sepa
          ? [
              `SEPA-Mandat: Mandatsreferenz ${mandate}, Gläubiger-ID ${settings.company.creditor_id}, Konto ${formatIban(sepa.iban).replace(/^(.{7}).*(.{4})$/, "$1 … $2")}. Wir kündigen jede Lastschrift mit der Rechnung an.`,
            ]
          : []),
        "Als Nächstes melden wir uns für den Kick-off. Wir freuen uns riesig auf die Zusammenarbeit!",
      ],
      sender: senderFor(row.grid_signer),
    }),
    attachments,
  });
  await sendAppMail(SHARED_MAILBOX, {
    to: [SHARED_MAILBOX],
    subject: `Unterschrieben: Angebot ${offer.number} · ${offer.customer_name ?? row.signer_name}`,
    body: `${row.signer_name} (${row.signer_email}) hat Angebot ${offer.number}, ${row.contract.title}${row.sepa_required ? " und das SEPA-Mandat" : ""} unterschrieben. Die Unterlagen liegen in der Kundenakte im Intranet.`,
    attachments,
  });
}
