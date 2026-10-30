import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { INVOICE_CATEGORIES, PAYMENT_METHODS, PREPAID_METHODS, type PaymentMethod } from "@/lib/sales/types";
import { getBeleg } from "./beleg";
import { db, type Row } from "./db";

// Rechnungsdaten aus dem Beleg selbst (PDF, Bild oder Mailtext) lesen. Die
// Einordnung beim Mail-Eingang sieht nur Mailtext und Dateinamen; Beträge,
// Fälligkeit und „schon bezahlt“ stehen aber meist erst im PDF.

type Extracted = {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number | null;
  net_amount: number | null;
  vat_amount: number | null;
  currency: string | null;
  payment_method: PaymentMethod | null;
  category: string | null;
  description: string | null;
  paid: boolean;
  paid_date: string | null;
};

const nullable = (type: string) => ({ type: [type, "null"] });

const SCHEMA = {
  type: "object",
  properties: {
    invoice_number: nullable("string"),
    invoice_date: nullable("string"),
    due_date: nullable("string"),
    amount: nullable("number"),
    net_amount: nullable("number"),
    vat_amount: nullable("number"),
    currency: nullable("string"),
    payment_method: { type: ["string", "null"], enum: [...PAYMENT_METHODS.map((m) => m.id), null] },
    category: { type: ["string", "null"], enum: [...INVOICE_CATEGORIES, null] },
    description: nullable("string"),
    paid: { type: "boolean" },
    paid_date: nullable("string"),
  },
  required: [
    "invoice_number", "invoice_date", "due_date", "amount", "net_amount", "vat_amount", "currency",
    "payment_method", "category", "description", "paid", "paid_date",
  ],
  additionalProperties: false,
};

const SYSTEM = `Du liest Eingangsrechnungen und Quittungen für die Buchhaltung einer deutschen Agentur aus. Gib nur an, was im Beleg steht.
- invoice_number: Rechnungs- bzw. Belegnummer genau wie gedruckt.
- invoice_date, due_date, paid_date: YYYY-MM-DD. due_date ist das Fälligkeits- bzw. Abbuchungsdatum; steht nur ein Zahlungsziel („zahlbar in 14 Tagen“), rechne es vom Rechnungsdatum aus.
- amount: zu zahlender Bruttobetrag (Endbetrag), net_amount: Nettosumme, vat_amount: Umsatzsteuer. Bei Reverse Charge oder Kleinunternehmer ist vat_amount 0. Zahlen ohne Tausendertrennzeichen.
- currency: ISO-Code (EUR, USD, GBP …).
- payment_method: ueberweisung, lastschrift (SEPA-Lastschrift/Einzug), karte (Kredit-/Debitkarte), paypal oder bar – nur wenn erkennbar.
- paid: true nur, wenn der Beleg sagt, dass schon bezahlt bzw. belastet wurde (z. B. „Paid“, „bezahlt“, „Betrag wurde von Ihrer Karte abgebucht“, Quittung/Receipt mit Zahlungsdatum). Eine angekündigte Lastschrift zu einem künftigen Datum ist noch nicht bezahlt. paid_date: Datum der Zahlung, wenn genannt.
- category: passende Kategorie aus der Liste.
- description: kurze deutsche Beschreibung der Leistung (max. 8 Wörter).`;

let client: Anthropic | null = null;

const isoDate = (value: string | null | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) / 100 : null);

function content(beleg: { contentType: string; bytes: Buffer }): Anthropic.Beta.BetaContentBlockParam {
  const data = beleg.bytes.toString("base64");
  if (/pdf/i.test(beleg.contentType)) return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  const image = beleg.contentType.match(/^image\/(png|jpe?g|gif|webp)/i)?.[1];
  if (image) {
    const media = `image/${image.toLowerCase().replace("jpg", "jpeg")}` as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    return { type: "image", source: { type: "base64", media_type: media, data } };
  }
  // Mailtext (HTML) als Klartext
  const text = beleg.bytes
    .toString("utf8")
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
  return { type: "text", text: `Beleg (Mailtext):\n\n${text.slice(0, 20_000)}` };
}

/** Beleg auslesen und fehlende Angaben der Rechnung ergänzen. Was schon
 * eingetragen ist (auch von Hand), bleibt; nur leere Felder werden gefüllt. */
export async function readInvoice(invoice: Row): Promise<Row> {
  const store = db();
  const beleg = await getBeleg(invoice);
  if (!beleg || !process.env.ANTHROPIC_API_KEY) {
    return store.update("invoices", invoice.id, { extracted_at: new Date().toISOString() });
  }

  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2048,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: [content(beleg), { type: "text", text: `Rechnungssteller laut Mail: ${invoice.vendor}` }] }],
  });
  const text = response.content.find((block) => block.type === "text");
  if (response.stop_reason === "refusal" || !text || text.type !== "text") throw new Error("Beleg konnte nicht ausgelesen werden");
  const data = JSON.parse(text.text) as Extracted;

  const found: Record<string, unknown> = {
    invoice_number: data.invoice_number?.trim() || null,
    invoice_date: isoDate(data.invoice_date),
    due_date: isoDate(data.due_date),
    amount: num(data.amount),
    net_amount: num(data.net_amount),
    vat_amount: num(data.vat_amount),
    payment_method: data.payment_method,
    category: data.category,
    description: data.description?.trim() || null,
  };
  const patch: Record<string, unknown> = { extracted_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(found)) {
    if (value !== null && value !== undefined && (invoice[key] === null || invoice[key] === undefined || invoice[key] === "")) patch[key] = value;
  }
  // Währung nur zusammen mit dem Betrag übernehmen, sonst passt sie nicht
  if (patch.amount !== undefined && data.currency && /^[A-Z]{3}$/.test(data.currency)) patch.currency = data.currency;
  // Bezahlt laut Beleg (Quittung, Kartenzahlung); der Bank-Abgleich setzt es sonst
  const method = (patch.payment_method ?? invoice.payment_method) as PaymentMethod | null;
  if (!invoice.paid && (data.paid || (method && PREPAID_METHODS.includes(method)))) {
    patch.paid = true;
    if (!invoice.paid_at) patch.paid_at = isoDate(data.paid_date) ?? (patch.invoice_date as string | undefined) ?? invoice.invoice_date ?? null;
  }
  return store.update("invoices", invoice.id, patch);
}
