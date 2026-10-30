// Ausgangsrechnungen: Typen und Bezeichnungen für Liste und Beleg

export type BillingKind =
  | "rechnung"
  | "gutschrift"
  | "storno"
  | "storno_gutschrift"
  | "angebot"
  | "auftrag"
  | "lieferschein"
  | "zahlungserinnerung"
  | "mahnung"
  | "serie"
  | "proforma"
  | "brief"
  | "sonstiges";

export type BillingStatus =
  | "entwurf"
  | "offen"
  | "teilbezahlt"
  | "bezahlt"
  | "storniert"
  | "angenommen"
  | "abgelehnt"
  | "erledigt";

/** Zeile der Liste (ohne Positionen und Rohdaten) */
export type BillingDocument = {
  id: string;
  kind: BillingKind;
  number: string | null;
  status: BillingStatus;
  title: string | null;
  customer_id: string | null;
  customer_name: string | null;
  ref_document_id: string | null;
  document_date: string | null;
  due_date: string | null;
  currency: string;
  amount_net: number;
  amount_gross: number;
  paid_amount: number;
  paid_at: string | null;
  recurring: Recurring | null;
  has_pdf: boolean;
  source: "intranet" | "easybill";
  finalized_at: string | null;
  sent_at: string | null;
  send_error: string | null;
};

export type Recurring = {
  status?: "RUNNING" | "PAUSE" | "STOP" | "WAITING";
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number | null;
  next_date?: string | null;
  /** easybill: Enddatum oder Anzahl */
  end_date_or_count?: string | null;
  /** Intranet: letzter Termin (inklusive) */
  end_date?: string | null;
  /** Wer die Serie ausführt; easybill-Serien laufen dort weiter, bis sie übernommen werden */
  managed_by?: "intranet" | "easybill";
};

export type BillingItem = {
  id: string;
  position: number;
  kind: "position" | "text";
  article_id: string | null;
  number: string | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_net: number;
  vat_percent: number;
  discount: number | null;
  discount_type: "prozent" | "betrag" | null;
  total_net: number;
  total_vat: number;
  total_gross: number;
};

export type BillingPayment = {
  id: string;
  paid_on: string;
  amount: number;
  method: string | null;
  reference: string | null;
  notes: string | null;
};

export type BillingAddress = Partial<
  Record<"company_name" | "first_name" | "last_name" | "suffix_1" | "suffix_2" | "street" | "zip_code" | "city" | "country", string | null>
>;

/** has_pdf: PDF liegt im Bucket; den Link holt /api/finance/ausgang/[id]/pdf */
export type BillingDetail = BillingDocument & {
  amount_vat: number;
  service_from: string | null;
  service_to: string | null;
  service_text: string | null;
  intro: string | null;
  closing: string | null;
  vat_option: string | null;
  address: BillingAddress | null;
  notes: string | null;
  payment_terms_days: number | null;
  recipient_email: string | null;
  sent_to: string | null;
  customer_number: string | null;
  items: BillingItem[];
  payments: BillingPayment[];
  /** Original, Storno, Mahnungen, Auftrag … */
  related: BillingDocument[];
};

export const KIND_LABEL: Record<BillingKind, string> = {
  rechnung: "Rechnung",
  gutschrift: "Gutschrift",
  storno: "Storno",
  storno_gutschrift: "Storno Gutschrift",
  angebot: "Angebot",
  auftrag: "Auftragsbestätigung",
  lieferschein: "Lieferschein",
  zahlungserinnerung: "Zahlungserinnerung",
  mahnung: "Mahnung",
  serie: "Serienrechnung",
  proforma: "Proforma",
  brief: "Brief",
  sonstiges: "Sonstiges",
};

/** Ansichten der Liste */
export const KIND_GROUPS = [
  { id: "rechnungen", label: "Rechnungen", kinds: ["rechnung", "gutschrift", "storno", "storno_gutschrift"] },
  { id: "angebote", label: "Angebote", kinds: ["angebot", "auftrag"] },
  { id: "serien", label: "Serienrechnungen", kinds: ["serie"] },
  { id: "mahnwesen", label: "Mahnwesen", kinds: ["zahlungserinnerung", "mahnung"] },
  { id: "sonstige", label: "Briefe & Sonstiges", kinds: ["brief", "lieferschein", "proforma", "sonstiges"] },
] as const satisfies readonly { id: string; label: string; kinds: readonly BillingKind[] }[];

export type KindGroup = (typeof KIND_GROUPS)[number]["id"] | "alle";

export const STATUS_LABEL: Record<BillingStatus, string> = {
  entwurf: "Entwurf",
  offen: "Offen",
  teilbezahlt: "Teilbezahlt",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  erledigt: "Erledigt",
};

const FREQUENCY: Record<string, [string, string]> = {
  DAILY: ["täglich", "Tage"],
  WEEKLY: ["wöchentlich", "Wochen"],
  MONTHLY: ["monatlich", "Monate"],
  YEARLY: ["jährlich", "Jahre"],
};

export function rhythm(recurring: Recurring | null) {
  if (!recurring?.frequency) return null;
  const [once, many] = FREQUENCY[recurring.frequency] ?? [recurring.frequency, recurring.frequency];
  const interval = recurring.interval ?? 1;
  return interval > 1 ? `alle ${interval} ${many}` : once;
}

export const SERIES_STATUS: Record<string, string> = { RUNNING: "Läuft", WAITING: "Läuft", PAUSE: "Pausiert", STOP: "Beendet" };

/** Rechnung, die noch (teilweise) offen und über dem Zahlungsziel ist */
export function isOverdue(doc: Pick<BillingDocument, "status" | "due_date">) {
  return (doc.status === "offen" || doc.status === "teilbezahlt") && !!doc.due_date && new Date(`${doc.due_date}T23:59:59`) < new Date();
}

/** Bezeichnung des Belegs: Nummer, bei Serien und Entwürfen der Titel */
export const docLabel = (doc: Pick<BillingDocument, "number" | "title" | "kind">) =>
  doc.number ?? doc.title ?? `${KIND_LABEL[doc.kind]} (Entwurf)`;

const moneyFormat = new Map<string, Intl.NumberFormat>();

/** Betrag mit Cent, z. B. 1.234,50 € */
export function money(value: number | null | undefined, currency = "EUR") {
  if (value === null || value === undefined) return "–";
  if (!moneyFormat.has(currency)) moneyFormat.set(currency, new Intl.NumberFormat("de-DE", { style: "currency", currency }));
  return moneyFormat.get(currency)!.format(value);
}

/** easybill-Texte enthalten etwas HTML (<br>, <b> …): als Klartext zeigen */
export function plain(text: string | null | undefined) {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------- Schreiben ----------

/** Position im Editor; Preise netto, Rabatt in Prozent oder als Betrag */
export type ItemInput = Pick<
  BillingItem,
  "kind" | "article_id" | "number" | "description" | "quantity" | "unit" | "unit_price_net" | "vat_percent" | "discount" | "discount_type"
>;

/** Entwurf einer Rechnung oder Gutschrift, oder eine Serie (Vorlage) */
export type DraftInput = {
  kind: "rechnung" | "gutschrift" | "serie" | "angebot";
  customer_id: string;
  ref_document_id?: string | null;
  address: BillingAddress;
  recipient_email: string | null;
  /** leer = Tag des Festschreibens */
  document_date: string | null;
  payment_terms_days: number;
  service_from: string | null;
  service_to: string | null;
  title: string | null;
  intro: string | null;
  closing: string | null;
  items: ItemInput[];
  recurring?: { frequency: "MONTHLY" | "YEARLY" | "WEEKLY"; interval: number; next_date: string; end_date: string | null; status: "RUNNING" | "PAUSE" | "STOP" };
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Netto einer Position nach Rabatt */
export function lineNet(item: Pick<ItemInput, "kind" | "quantity" | "unit_price_net" | "discount" | "discount_type">) {
  if (item.kind === "text") return 0;
  const base = Number(item.quantity) * Number(item.unit_price_net);
  const discount = !item.discount ? 0 : item.discount_type === "betrag" ? Number(item.discount) : (base * Number(item.discount)) / 100;
  return round2(base - discount);
}

/** Summen eines Belegs; USt je Steuersatz auf die Nettosumme gerechnet */
export function computeTotals(items: Pick<ItemInput, "kind" | "quantity" | "unit_price_net" | "discount" | "discount_type" | "vat_percent">[]) {
  const rates = new Map<number, number>();
  for (const item of items) {
    if (item.kind === "text") continue;
    const rate = Number(item.vat_percent);
    rates.set(rate, round2((rates.get(rate) ?? 0) + lineNet(item)));
  }
  const byRate = [...rates.entries()].sort(([a], [b]) => b - a).map(([rate, net]) => ({ rate, net, vat: round2((net * rate) / 100) }));
  const net = round2(byRate.reduce((sum, r) => sum + r.net, 0));
  const vat = round2(byRate.reduce((sum, r) => sum + r.vat, 0));
  return { net, vat, gross: round2(net + vat), byRate };
}

// ---------- Firmendaten und Texte ----------

export type BillingCompany = {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  tax_number: string;
  vat_id: string;
  bank: string;
  iban: string;
  bic: string;
  managing_director: string;
  register: string;
  /** SEPA-Gläubiger-Identifikationsnummer (DE..ZZZ..) */
  creditor_id: string;
};

export type BillingSettings = {
  company: BillingCompany;
  payment_terms_days: number;
  intro: string;
  closing: string;
  mail_subject: string;
  mail_body: string;
};

/** Stand der easybill-Rechnungen (Oktober 2026) */
export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  company: {
    name: "GRID AGENCY UG",
    street: "Eichendorffstrasse 32",
    zip: "60320",
    city: "Frankfurt am Main",
    phone: "015122910161",
    email: "buchhaltung@grid-agency.de",
    website: "www.grid-agency.de",
    tax_number: "37/317/50165",
    vat_id: "DE350319219",
    bank: "Commerzbank AG",
    iban: "DE23 1204 0000 0078 0965 00",
    bic: "COBADEFFXXX",
    managing_director: "Frau Giulia Cavallino",
    register: "Amtsgericht Charlottenburg HRB 235987 B",
    creditor_id: "",
  },
  payment_terms_days: 5,
  intro: "Sehr geehrte Damen und Herren,\nnachfolgend berechnen wir Ihnen wie vereinbart:",
  // Betrag, Fälligkeit und Bankdaten stehen in der Zahlungsbox des PDFs
  closing: "Vielen Dank für die gute Zusammenarbeit.\n\nMit freundlichen Grüßen\n{Firma}",
  mail_subject: "{Belegart} {Nummer} – {Firma}",
  mail_body:
    "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere {Belegart} {Nummer} über {Betrag}. Bitte begleichen Sie den Betrag bis zum {Fällig}.\n\nMit freundlichen Grüßen\n{Firma}",
};

/** Texte für Storno und Gutschrift (statt Einleitung und Schluss der Rechnung) */
export const CORRECTION_TEXTS = {
  storno: {
    intro: "Sehr geehrte Damen und Herren,\nhiermit stornieren wir die unten genannte Rechnung vollständig.",
    closing: "Bereits gezahlte Beträge erstatten wir Ihnen.\n\nMit freundlichen Grüßen\n\n{Firma}",
    mail: "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die {Belegart} {Nummer}. Sie hebt unsere Rechnung {Bezug} auf.\n\nMit freundlichen Grüßen\n{Firma}",
  },
  gutschrift: {
    intro: "Sehr geehrte Damen und Herren,\nwir schreiben Ihnen folgende Beträge gut:",
    closing: "Den Betrag erstatten wir Ihnen bzw. verrechnen ihn mit offenen Rechnungen.\n\nMit freundlichen Grüßen\n\n{Firma}",
    mail: "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere {Belegart} {Nummer} über {Betrag}.\n\nMit freundlichen Grüßen\n{Firma}",
  },
};

/** Texte für Angebote (Einleitung und Schluss) */
export const OFFER_TEXTS = {
  intro: "Sehr geehrte Damen und Herren,\nvielen Dank für das gute Gespräch. Gerne bieten wir Ihnen folgende Leistungen an:",
  closing: "Mit Annahme dieses Angebots kommt der beigefügte Agenturvertrag zustande. Wir freuen uns auf die Zusammenarbeit!\n\nMit freundlichen Grüßen\n{Firma}",
};

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const dateDe = (value: string | null | undefined) => (value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");

/** Platzhalter in Texten: eigene ({Monat}, {Zeitraum}, {Jahr}, {Fällig},
 * {Nummer}, {Belegart}, {Betrag}, {Bezug}, {Firma}) und die aus easybill
 * übernommenen (%KUNDE.ANREDE%, %DOKUMENT.DATUM-FAELLIG%, %FIRMA.FIRMA%). */
export function fillText(
  text: string | null | undefined,
  doc: Partial<Pick<BillingDetail, "kind" | "number" | "due_date" | "service_from" | "service_to" | "document_date" | "amount_gross" | "currency">> & {
    reference?: string | null;
  },
  company: Pick<BillingCompany, "name">
) {
  if (!text) return "";
  const period = doc.service_from ?? doc.document_date ?? null;
  const month = period ? `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}` : "";
  const range = doc.service_from ? (doc.service_to && doc.service_to !== doc.service_from ? `${dateDe(doc.service_from)} – ${dateDe(doc.service_to)}` : dateDe(doc.service_from)) : "";
  const values: Record<string, string> = {
    Monat: month,
    Zeitraum: range,
    Jahr: period?.slice(0, 4) ?? "",
    Fällig: dateDe(doc.due_date) || "Fälligkeit",
    Faellig: dateDe(doc.due_date) || "Fälligkeit",
    Nummer: doc.number ?? "",
    Belegart: doc.kind ? KIND_LABEL[doc.kind] : "",
    Betrag: doc.amount_gross === undefined ? "" : money(Math.abs(doc.amount_gross), doc.currency ?? "EUR"),
    Bezug: doc.reference ?? "",
    Firma: company.name,
  };
  return text
    .replace(/\{(\p{L}+)\}/gu, (match, key: string) => values[key] ?? match)
    .replace(/%KUNDE\.ANREDE%/g, "Sehr geehrte Damen und Herren")
    .replace(/%DOKUMENT\.DATUM-FAELLIG%/g, values.Fällig)
    .replace(/%FIRMA\.FIRMA%/g, company.name);
}

/** Datum + n Tage / Monate / Jahre als yyyy-mm-dd */
export function addPeriod(date: string, frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY", count: number) {
  const d = new Date(`${date}T12:00:00Z`);
  if (frequency === "DAILY") d.setUTCDate(d.getUTCDate() + count);
  else if (frequency === "WEEKLY") d.setUTCDate(d.getUTCDate() + 7 * count);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + (frequency === "YEARLY" ? 12 * count : count));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString().slice(0, 10);
}

/** Heute in Berlin als yyyy-mm-dd */
export const todayBerlin = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
