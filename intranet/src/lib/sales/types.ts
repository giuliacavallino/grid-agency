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
  received_at: string | null;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  classification: "anfrage" | "bewerbung" | "sonstiges";
  reason: string | null;
  lead_id: string | null;
};

export type Settings = { capacity: { team_hours_per_month: number } };

/** Position für „ganz oben“ in einer Pipeline-Spalte (absteigend sortiert). */
export const topPosition = () => Date.now() / 1000;
