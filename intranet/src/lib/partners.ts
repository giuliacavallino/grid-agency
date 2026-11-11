// Netzwerk: Freelancer und Partner, mit denen GRID arbeitet (Personal → Netzwerk)

export const PARTNER_KINDS = [
  { id: "freelancer", label: "Freelancer" },
  { id: "partner", label: "Partner" },
] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number]["id"];

export const PARTNER_CATEGORIES: Record<PartnerKind, string[]> = {
  freelancer: ["Fotograf", "Videograf", "Postproduktion", "Grafik & Design", "Content Creator", "Model", "Text", "Social Media", "Ads & Performance", "Web & Entwicklung", "Sonstiges"],
  partner: ["Catering", "Food-Partner", "Location", "Event", "Druck & Produktion", "Agentur & Kooperation", "Influencer", "Sonstiges"],
};

export const RATE_UNITS = [
  { id: "stunde", label: "pro Stunde", short: "/Std." },
  { id: "halbtag", label: "pro Halbtag", short: "/Halbtag" },
  { id: "tag", label: "pro Tag", short: "/Tag" },
  { id: "projekt", label: "pro Projekt", short: "/Projekt" },
  { id: "monat", label: "pro Monat", short: "/Monat" },
  { id: "pauschal", label: "pauschal", short: " pauschal" },
] as const;
export type RateUnit = (typeof RATE_UNITS)[number]["id"];

export const PARTNER_STATUS = [
  { id: "aktiv", label: "Aktiv" },
  { id: "pausiert", label: "Pausiert" },
  { id: "nicht_mehr", label: "Nicht mehr" },
] as const;
export type PartnerStatus = (typeof PARTNER_STATUS)[number]["id"];

export type Partner = {
  id: string;
  created_at: string;
  updated_at: string;
  kind: PartnerKind;
  category: string;
  /** Person bzw. Ansprechperson */
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  city: string | null;
  /** Schwerpunkt, Stil, Spezialgebiet */
  focus: string | null;
  rate: number | null;
  rate_unit: RateUnit | null;
  /** Konditionen in Worten, z. B. „inkl. Schnitt für 3 Reels“ */
  rate_note: string | null;
  rating: number | null;
  status: PartnerStatus;
  /** Projekte mit GRID (Kunde, Monat) */
  projects: string | null;
  notes: string | null;
  last_contact: string | null;
  source: string | null;
  lead_id: string | null;
};

export const rateText = (p: Pick<Partner, "rate" | "rate_unit" | "rate_note">) => {
  const unit = RATE_UNITS.find((u) => u.id === p.rate_unit)?.short ?? "";
  const amount = p.rate != null ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(p.rate)} €${unit}` : "";
  return [amount, p.rate_note].filter(Boolean).join(" · ");
};
