import "server-only";
import { DEMO, FINANCE_MAILBOX } from "@/lib/config";
import {
  CORRECTION_TEXTS,
  KIND_LABEL,
  computeTotals,
  docLabel,
  fillText,
  lineNet,
  plain,
  todayBerlin,
  type BillingAddress,
  type BillingDetail,
  type DraftInput,
  type ItemInput,
} from "@/lib/billing";
import { BUCKET, billingSettings, check, getBilling } from "./billing";
import { sb } from "./db";
import { sendAppMail } from "./graph-app";
import { renderInvoicePdf } from "./invoice-pdf";

// Rechnungsausgang: Entwürfe anlegen und ändern, festschreiben (Nummer aus
// billing_finalize, danach sperrt die Datenbank den Beleg), PDF ablegen,
// Storno, Korrektur, Gutschrift, Zahlungen. Festgeschriebenes ändert nur
// noch Status, Zahlungen und Versand.

export class BillingError extends Error {}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const num = (value: unknown) => Number(value ?? 0);

function guardDemo() {
  if (DEMO) throw new BillingError("In der Vorschau können keine Belege geschrieben werden");
}

/** Position aus dem Browser prüfen und mit Summen versehen */
function itemRow(documentId: string, item: ItemInput, position: number) {
  const text = item.kind === "text";
  const quantity = text ? 0 : num(item.quantity);
  const price = text ? 0 : num(item.unit_price_net);
  const vat = num(item.vat_percent);
  if (!Number.isFinite(quantity) || !Number.isFinite(price) || !Number.isFinite(vat) || vat < 0 || vat > 100) {
    throw new BillingError(`Position ${position + 1}: Menge, Preis oder Steuersatz ungültig`);
  }
  const discount = item.discount ? num(item.discount) : null;
  const clean = { kind: text ? ("text" as const) : ("position" as const), quantity, unit_price_net: price, discount, discount_type: discount ? (item.discount_type ?? "prozent") : null };
  const net = lineNet(clean);
  const totalVat = text ? 0 : round2((net * vat) / 100);
  return {
    document_id: documentId,
    position,
    ...clean,
    article_id: item.article_id || null,
    number: item.number?.trim() || null,
    description: item.description?.trim() || null,
    unit: item.unit?.trim() || null,
    vat_percent: vat,
    total_net: net,
    total_vat: totalVat,
    total_gross: round2(net + totalVat),
  };
}

const ADDRESS_KEYS = ["company_name", "first_name", "last_name", "suffix_1", "suffix_2", "street", "zip_code", "city", "country"] as const;

function cleanAddress(address: BillingAddress | null | undefined): BillingAddress {
  const out: BillingAddress = {};
  for (const key of ADDRESS_KEYS) {
    const value = address?.[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}

const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

async function loadRow(id: string) {
  const row = check(
    await sb().from("billing_documents").select("id,kind,status,source,finalized_at,number,document_date,ref_document_id,recurring").eq("id", id).maybeSingle()
  ) as {
    id: string;
    kind: string;
    status: string;
    source: string;
    finalized_at: string | null;
    number: string | null;
    document_date: string | null;
    ref_document_id: string | null;
    recurring: Record<string, unknown> | null;
  } | null;
  if (!row) throw new BillingError("Beleg nicht gefunden");
  return row;
}

async function replaceItems(documentId: string, items: ItemInput[]) {
  check(await sb().from("billing_items").delete().eq("document_id", documentId));
  const rows = items.map((item, i) => itemRow(documentId, item, i));
  if (rows.length) check(await sb().from("billing_items").insert(rows));
  return rows;
}

/** Neuer Entwurf (id = null) oder Änderung eines Entwurfs bzw. einer Serie */
export async function saveDraft(id: string | null, input: DraftInput): Promise<string> {
  guardDemo();
  if (!["rechnung", "gutschrift", "serie", "angebot"].includes(input.kind)) throw new BillingError("Unbekannte Belegart");
  if (!input.customer_id) throw new BillingError("Bitte einen Kunden wählen");
  if (!Array.isArray(input.items)) throw new BillingError("Positionen fehlen");
  const terms = Math.round(num(input.payment_terms_days));
  if (!Number.isFinite(terms) || terms < 0 || terms > 365) throw new BillingError(input.kind === "angebot" ? "Gültigkeit ungültig" : "Zahlungsziel ungültig");

  if (id) {
    const current = await loadRow(id);
    const editable = current.source === "intranet" && !current.finalized_at && (current.status === "entwurf" || current.kind === "serie");
    if (!editable) throw new BillingError("Nur Entwürfe und Serien aus dem Intranet lassen sich bearbeiten");
    if (current.kind !== input.kind) throw new BillingError("Die Belegart lässt sich nicht ändern");
  }

  const rows = input.items.map((item, i) => itemRow("", item, i));
  const totals = computeTotals(rows);
  const recurring =
    input.kind === "serie"
      ? (() => {
          const r = input.recurring;
          if (!r || !["MONTHLY", "YEARLY", "WEEKLY"].includes(r.frequency) || !isoDate(r.next_date)) {
            throw new BillingError("Rhythmus und nächster Termin der Serie fehlen");
          }
          const interval = Math.max(1, Math.min(24, Math.round(num(r.interval) || 1)));
          return {
            frequency: r.frequency,
            interval,
            next_date: r.next_date,
            end_date: isoDate(r.end_date),
            status: ["RUNNING", "PAUSE", "STOP"].includes(r.status) ? r.status : "RUNNING",
            managed_by: "intranet",
          };
        })()
      : null;

  const row = {
    kind: input.kind,
    source: "intranet",
    status: input.kind === "serie" ? (recurring?.status === "STOP" ? "erledigt" : "offen") : "entwurf",
    customer_id: input.customer_id,
    ref_document_id: input.ref_document_id || null,
    address: cleanAddress(input.address),
    recipient_email: input.recipient_email?.trim().toLowerCase() || null,
    document_date: input.kind === "serie" ? null : isoDate(input.document_date),
    payment_terms_days: terms,
    service_from: isoDate(input.service_from),
    service_to: isoDate(input.service_to),
    title: input.title?.trim() || null,
    intro: input.intro ?? null,
    closing: input.closing ?? null,
    amount_net: totals.net,
    amount_vat: totals.vat,
    amount_gross: totals.gross,
    recurring,
  };

  const saved = id
    ? (check(await sb().from("billing_documents").update(row).eq("id", id).select("id").single()) as { id: string })
    : (check(await sb().from("billing_documents").insert(row).select("id").single()) as { id: string });
  await replaceItems(saved.id, input.items);
  return saved.id;
}

export async function deleteDraft(id: string) {
  guardDemo();
  const row = await loadRow(id);
  if (row.source !== "intranet" || row.finalized_at || row.status !== "entwurf") {
    throw new BillingError("Nur Entwürfe lassen sich löschen");
  }
  check(await sb().from("billing_documents").delete().eq("id", id));
}

/** Nummer und Datum des Originals für Überschrift und Texte */
async function referenceOf(doc: BillingDetail) {
  if (!doc.ref_document_id) return null;
  const ref = doc.related.find((r) => r.id === doc.ref_document_id);
  if (!ref || ref.kind === "serie") return null;
  return { label: KIND_LABEL[ref.kind], number: ref.number, date: ref.document_date };
}

/** PDF eines Belegs rendern: festgeschrieben wie abgelegt, Entwürfe mit
 * Vorschau-Datum und Fälligkeit und dem Hinweis ENTWURF */
export async function renderPdf(doc: BillingDetail) {
  const settings = await billingSettings();
  let view = doc;
  if (!doc.number) {
    const date = doc.document_date ?? todayBerlin();
    const due = new Date(`${date}T12:00:00Z`);
    due.setUTCDate(due.getUTCDate() + (doc.payment_terms_days ?? settings.payment_terms_days));
    view = { ...doc, document_date: date, due_date: due.toISOString().slice(0, 10) };
  }
  return renderInvoicePdf({ doc: view, settings, reference: await referenceOf(doc) });
}

const safe = (text: string) => text.replace(/[^\w.-]+/g, "_");

/** PDF eines festgeschriebenen Belegs einmalig ablegen */
async function storePdf(id: string) {
  const doc = await getBilling(id);
  if (!doc?.number || !doc.finalized_at) throw new BillingError("Beleg ist nicht festgeschrieben");
  const pdf = await renderPdf(doc);
  const path = `intranet/${doc.document_date?.slice(0, 4)}/${doc.kind}_${safe(doc.number)}.pdf`;
  check(await sb().storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true }));
  check(await sb().from("billing_documents").update({ pdf_path: path }).eq("id", id));
}

/** Festschreiben: Nummer vergeben, sperren, PDF ablegen */
export async function finalize(id: string) {
  guardDemo();
  const { error } = await sb().rpc("billing_finalize", { p_id: id });
  if (error) throw new BillingError(error.message);
  await storePdf(id);
  return id;
}

/** PDF nachholen, falls das Ablegen beim Festschreiben scheiterte */
export async function ensurePdf(id: string) {
  const row = check(await sb().from("billing_documents").select("pdf_path,finalized_at,source").eq("id", id).maybeSingle()) as {
    pdf_path: string | null;
    finalized_at: string | null;
    source: string;
  } | null;
  if (row && !row.pdf_path && row.finalized_at && row.source === "intranet") await storePdf(id);
}

/** Positionen eines Belegs als Eingabe (für Storno, Korrektur, Gutschrift);
 * sign -1 dreht jede Position um */
function copyItems(doc: BillingDetail, sign: 1 | -1): ItemInput[] {
  return doc.items.map((item) => ({
    kind: item.kind,
    article_id: item.article_id,
    number: item.number,
    description: plain(item.description),
    quantity: item.quantity,
    unit: item.unit,
    unit_price_net: sign * item.unit_price_net,
    vat_percent: item.vat_percent,
    discount: item.discount,
    discount_type: item.discount_type,
  }));
}

async function original(id: string) {
  const doc = await getBilling(id);
  if (!doc) throw new BillingError("Beleg nicht gefunden");
  if (!["rechnung", "gutschrift"].includes(doc.kind) || !doc.number) {
    throw new BillingError("Nur festgeschriebene Rechnungen und Gutschriften lassen sich stornieren oder korrigieren");
  }
  if (doc.status === "storniert") throw new BillingError(`${docLabel(doc)} ist bereits storniert`);
  if (doc.related.some((r) => (r.kind === "storno" || r.kind === "storno_gutschrift") && r.ref_document_id === id)) {
    throw new BillingError(`Zu ${docLabel(doc)} gibt es schon ein Storno`);
  }
  if (!doc.customer_id) throw new BillingError("Der Beleg hat keinen Kunden");
  return doc;
}

/** Storno: vollständige Gegenbuchung mit eigener Nummer, sofort festgeschrieben */
export async function cancel(id: string) {
  guardDemo();
  const doc = await original(id);
  const kind = doc.kind === "gutschrift" ? "storno_gutschrift" : "storno";
  // Gegenbuchung: jede Position mit umgekehrtem Vorzeichen
  const items = copyItems(doc, -1);
  const totals = computeTotals(items);
  const inserted = check(
    await sb()
      .from("billing_documents")
      .insert({
        kind,
        source: "intranet",
        status: "entwurf",
        customer_id: doc.customer_id,
        ref_document_id: doc.id,
        address: doc.address,
        recipient_email: doc.recipient_email,
        payment_terms_days: 0,
        service_from: doc.service_from,
        service_to: doc.service_to,
        service_text: doc.service_text,
        title: doc.title,
        intro: CORRECTION_TEXTS.storno.intro,
        closing: CORRECTION_TEXTS.storno.closing,
        vat_option: doc.vat_option,
        currency: doc.currency,
        amount_net: totals.net,
        amount_vat: totals.vat,
        amount_gross: totals.gross,
      })
      .select("id")
      .single()
  ) as { id: string };
  await replaceItems(inserted.id, items);
  await finalize(inserted.id);
  return inserted.id;
}

/** Entwurf aus einem bestehenden Beleg (Korrektur: Rechnung, Gutschrift: negativ) */
async function draftFrom(doc: BillingDetail, kind: "rechnung" | "gutschrift") {
  const settings = await billingSettings();
  return saveDraft(null, {
    kind,
    customer_id: doc.customer_id!,
    ref_document_id: doc.id,
    address: doc.address ?? {},
    recipient_email: doc.recipient_email,
    document_date: null,
    payment_terms_days: doc.payment_terms_days ?? settings.payment_terms_days,
    service_from: doc.service_from,
    service_to: doc.service_to,
    title: doc.title,
    intro: kind === "gutschrift" ? CORRECTION_TEXTS.gutschrift.intro : (doc.intro ?? settings.intro),
    closing: kind === "gutschrift" ? CORRECTION_TEXTS.gutschrift.closing : (doc.closing ?? settings.closing),
    items: copyItems(doc, kind === "gutschrift" ? -1 : 1),
  });
}

/** Korrektur: Original stornieren und eine Kopie als Entwurf anlegen */
export async function correct(id: string) {
  guardDemo();
  const doc = await original(id);
  if (doc.kind !== "rechnung") throw new BillingError("Nur Rechnungen lassen sich korrigieren");
  const storno = await cancel(id);
  const draft = await draftFrom(doc, "rechnung");
  return { storno, draft };
}

/** Gutschrift zu einer Rechnung als Entwurf (Positionen zum Anpassen) */
export async function credit(id: string) {
  guardDemo();
  const doc = await getBilling(id);
  if (!doc || doc.kind !== "rechnung" || !doc.number || !doc.customer_id) {
    throw new BillingError("Gutschriften gibt es nur zu festgeschriebenen Rechnungen");
  }
  return draftFrom(doc, "gutschrift");
}

// ---------- Zahlungen und Versand ----------

export async function addPayment(id: string, input: { paid_on: string; amount: number; method?: string | null; reference?: string | null }) {
  guardDemo();
  const doc = await getBilling(id);
  if (!doc || !["offen", "teilbezahlt", "bezahlt"].includes(doc.status)) throw new BillingError("Für diesen Beleg lassen sich keine Zahlungen erfassen");
  const amount = round2(num(input.amount));
  if (!amount || !Number.isFinite(amount)) throw new BillingError("Betrag fehlt");
  if (!isoDate(input.paid_on)) throw new BillingError("Datum fehlt");
  check(
    await sb()
      .from("billing_payments")
      .insert({ document_id: id, paid_on: input.paid_on, amount, method: input.method?.trim() || null, reference: input.reference?.trim() || null })
  );
}

export async function removePayment(id: string, paymentId: string) {
  guardDemo();
  const payment = check(await sb().from("billing_payments").select("id,easybill_id").eq("id", paymentId).eq("document_id", id).maybeSingle()) as {
    easybill_id: number | null;
  } | null;
  if (!payment) throw new BillingError("Zahlung nicht gefunden");
  if (payment.easybill_id) throw new BillingError("Zahlungen aus easybill bleiben erhalten");
  check(await sb().from("billing_payments").delete().eq("id", paymentId));
}

export async function markSent(id: string, to: string) {
  guardDemo();
  check(await sb().from("billing_documents").update({ sent_at: new Date().toISOString(), sent_to: to, send_error: null }).eq("id", id));
}

/** PDF eines Belegs als Mail-Anhang (base64) */
export async function pdfAttachment(id: string) {
  const doc = await getBilling(id);
  if (!doc) throw new BillingError("Beleg nicht gefunden");
  let bytes: Buffer;
  const path = (check(await sb().from("billing_documents").select("pdf_path").eq("id", id).single()) as { pdf_path: string | null }).pdf_path;
  if (path) {
    const { data, error } = await sb().storage.from(BUCKET).download(path);
    if (error) throw new Error(error.message);
    bytes = Buffer.from(await data.arrayBuffer());
  } else {
    bytes = await renderPdf(doc);
  }
  return { doc, name: `${KIND_LABEL[doc.kind]} ${doc.number ?? "Entwurf"}.pdf`, contentType: "application/pdf", contentBytes: bytes.toString("base64") };
}

/** Betreff und Text der Mail mit dem Beleg */
export async function mailDraft(doc: BillingDetail) {
  const settings = await billingSettings();
  const reference = await referenceOf(doc);
  const context = { ...doc, reference: reference?.number ?? null };
  const body =
    doc.kind === "storno" || doc.kind === "storno_gutschrift"
      ? CORRECTION_TEXTS.storno.mail
      : doc.kind === "gutschrift"
        ? CORRECTION_TEXTS.gutschrift.mail
        : settings.mail_body;
  return {
    subject: fillText(settings.mail_subject, context, settings.company),
    body: fillText(body, context, settings.company),
  };
}

/** Versand ohne angemeldete Person (Serienrechnungen): braucht in Entra die
 * Anwendungsberechtigung Mail.Send */
export async function sendFromServer(id: string) {
  const attachment = await pdfAttachment(id);
  const { doc } = attachment;
  const to = doc.recipient_email;
  if (!to) throw new BillingError("Keine Empfänger-Adresse");
  const { subject, body } = await mailDraft(doc);
  await sendAppMail(FINANCE_MAILBOX, {
    to: to.split(/[,;\s]+/).filter(Boolean),
    subject,
    body,
    attachments: [{ name: attachment.name, contentType: attachment.contentType, contentBytes: attachment.contentBytes }],
  });
  await markSent(id, to);
}
