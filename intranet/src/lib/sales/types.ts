export const STAGES = [
  { id: "neu", label: "Neuer Lead" },
  { id: "eingeladen", label: "Eingeladen" },
  { id: "erstgespraech", label: "Erstgespräch" },
  { id: "angebot", label: "Angebot" },
  { id: "gewonnen", label: "Kunde gewonnen" },
] as const;
export type Stage = (typeof STAGES)[number]["id"];

export const SOURCES = [
  { id: "website", label: "Website" },
  { id: "instagram", label: "Instagram" },
  { id: "meta", label: "Meta Ads" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "E-Mail" },
  { id: "empfehlung", label: "Empfehlung" },
  { id: "manuell", label: "Manuell" },
] as const;
export type Source = (typeof SOURCES)[number]["id"];

export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  stage: Stage;
  position: number;
  status: "offen" | "verloren";
  source: Source;
  source_ref: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  budget: string | null;
  value: number | null;
  owner: string | null;
  next_step: string | null;
  next_step_at: string | null;
  customer_id: string | null;
  won_at: string | null;
  lost_reason: string | null;
};

export type Activity = {
  id: string;
  created_at: string;
  lead_id: string;
  kind: "notiz" | "stage" | "email" | "anruf" | "termin" | "system";
  author: string | null;
  body: string | null;
  from_stage: Stage | null;
  to_stage: Stage | null;
};

export type Customer = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  status: "aktiv" | "pausiert" | "ehemalig";
  source: string | null;
  notes: string | null;
  lead_id: string | null;
};

export const UNITS = [
  { id: "monatlich", label: "pro Monat" },
  { id: "einmalig", label: "einmalig" },
  { id: "stunde", label: "pro Stunde" },
  { id: "tag", label: "pro Tag" },
] as const;

export type Article = {
  id: string;
  created_at: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number;
  unit: (typeof UNITS)[number]["id"];
  hours: number;
  active: boolean;
};

export type Retainer = {
  id: string;
  created_at: string;
  customer_id: string;
  article_id: string | null;
  title: string;
  monthly_fee: number;
  hours_per_month: number;
  start_date: string;
  end_date: string | null;
  status: "aktiv" | "pausiert" | "gekuendigt";
  notes: string | null;
};

export type InboundMessage = {
  id: string;
  mailbox: string | null;
  received_at: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  classification: "anfrage" | "bewerbung" | "rechnung" | "sonstiges";
  reason: string | null;
  lead_id: string | null;
  invoice_id: string | null;
  application_id: string | null;
};

// ---------- Finance: Eingangsrechnungen ----------

export const INVOICE_STAGES = [
  { id: "neu", label: "Neu", color: "#afaaa0" },
  { id: "freigegeben", label: "Freigegeben", color: "#7fa8ff" },
  { id: "datev", label: "An DATEV gesendet", color: "#9fd8a8" },
] as const;
export type InvoiceStage = (typeof INVOICE_STAGES)[number]["id"] | "abgelehnt";

export const PAYMENT_METHODS = [
  { id: "ueberweisung", label: "Überweisung" },
  { id: "lastschrift", label: "Lastschrift" },
  { id: "karte", label: "Karte" },
  { id: "paypal", label: "PayPal" },
  { id: "bar", label: "Bar" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"];
/** Zahlungsarten, bei denen die Rechnung schon bezahlt ist. Lastschriften
 * nicht: die gelten erst als bezahlt, wenn der Bank-Abgleich sie findet. */
export const PREPAID_METHODS: readonly PaymentMethod[] = ["karte", "paypal", "bar"];

export const INVOICE_CATEGORIES = [
  "Software & Abos",
  "Freelancer",
  "Produktion",
  "Werbung & Ads",
  "Miete & Nebenkosten",
  "Telefon & Internet",
  "Reise & Bewirtung",
  "Büro & Material",
  "Beratung & Gebühren",
  "Sonstiges",
] as const;

export type Invoice = {
  id: string;
  created_at: string;
  updated_at: string;
  stage: InvoiceStage;
  position: number;
  source_ref: string | null;
  mailbox: string | null;
  graph_id: string | null;
  received_at: string | null;
  vendor: string;
  vendor_email: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount: number | null;
  currency: string;
  net_amount: number | null;
  vat_amount: number | null;
  payment_method: PaymentMethod | null;
  category: string | null;
  paid: boolean;
  /** Buchungsdatum der zugeordneten Abbuchung (Bank-Abgleich) */
  paid_at: string | null;
  bank_transaction_id: string | null;
  /** Beleg ausgelesen (Beträge, Fälligkeit, bezahlt); leer = steht noch aus */
  extracted_at: string | null;
  description: string | null;
  attachment_names: string[] | null;
  approved_by: string | null;
  approved_at: string | null;
  datev_sent_at: string | null;
  datev_sent_by: string | null;
  notes: string | null;
};

// ---------- Personal: Bewerbungen ----------

export const APPLICATION_STAGES = [
  { id: "neu", label: "Neue Bewerbung", color: "#afaaa0" },
  { id: "gespraech", label: "Gespräch", color: "#7fa8ff" },
  { id: "case_study", label: "Case Study", color: "#b58cf0" },
  { id: "zusage", label: "Zusage", color: "#9fd8a8" },
  { id: "absage", label: "Absage", color: "#ec8a84" },
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number]["id"];

export type Application = {
  id: string;
  created_at: string;
  updated_at: string;
  stage: ApplicationStage;
  position: number;
  source_ref: string | null;
  mailbox: string | null;
  graph_id: string | null;
  received_at: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  position_title: string | null;
  message: string | null;
  attachment_names: string[] | null;
  /** "website" bei Bewerbungen über das Formular der Website */
  source: string | null;
  job_slug: string | null;
  link: string | null;
  /** Hochgeladene Unterlagen (Bucket „bewerbungen“) */
  files: ApplicationFile[];
  owner: string | null;
  next_step: string | null;
  next_step_at: string | null;
  notes: string | null;
};

export type ApplicationFile = { path: string; name: string; type: string; size: number };

/** Offene Stelle auf der Website; Texte stehen in der Website, hier nur An/Aus */
export type JobPosting = { id: string; slug: string; title: string; active: boolean; position: number; updated_at: string };

export type Settings = { capacity: { team_hours_per_month: number }; datev: { upload_address: string } };

/** Position für „ganz oben“ in einer Pipeline-Spalte (absteigend sortiert). */
export const topPosition = () => Date.now() / 1000;
