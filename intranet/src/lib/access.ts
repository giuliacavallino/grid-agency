// Benutzer und Rechte (Admin → Benutzer & Rechte). Gilt in Browser und
// Server; geprüft wird immer auf dem Server.

export type Role = "admin" | "member";

export type Member = {
  email: string;
  name: string;
  role: Role;
  /** Bereiche (ids aus AREAS), die ein member sieht; admin sieht alles */
  areas: string[];
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Bereiche, die man einzelnen Personen freigeben kann. Admin (Passwörter,
 * Benutzer, Firmendaten) gibt es nur mit der Rolle admin. */
export const GRANTABLE_AREAS = ["sales", "finance", "personal", "marketing", "mail", "kalender", "aufgaben"];

export const isAdmin = (member: Pick<Member, "role"> | null | undefined) => member?.role === "admin";

export const hasArea = (member: Pick<Member, "role" | "areas"> | null | undefined, area: string) =>
  !!member && (member.role === "admin" || (area !== "admin" && member.areas.includes(area)));

export type Company = {
  name: string;
  legal_form: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  managing_directors: string;
  register_court: string;
  register_number: string;
  vat_id: string;
  tax_number: string;
  bank: string;
  iban: string;
  bic: string;
};

export const EMPTY_COMPANY: Company = {
  name: "",
  legal_form: "",
  street: "",
  zip: "",
  city: "",
  country: "Deutschland",
  phone: "",
  email: "",
  website: "",
  managing_directors: "",
  register_court: "",
  register_number: "",
  vat_id: "",
  tax_number: "",
  bank: "",
  iban: "",
  bic: "",
};
