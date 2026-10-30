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
};

export type Recurring = {
  status?: "RUNNING" | "PAUSE" | "STOP" | "WAITING";
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number | null;
  next_date?: string | null;
  end_date_or_count?: string | null;
};

export type BillingItem = {
  id: string;
  position: number;
  kind: "position" | "text";
  number: string | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_net: number;
  vat_percent: number;
  discount: number | null;
  discount_type: "prozent" | "betrag" | null;
  total_net: number;
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

/** has_pdf: PDF liegt im Bucket; den Link holt /api/finance/belege/[id]/pdf */
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
