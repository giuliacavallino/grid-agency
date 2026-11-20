// Social-Media-Tage: Feiertage, Aktionstage („Tag des Croissants“) und
// Termine des Kunden, die im Redaktionskalender als Chips über den Tagen
// stehen. workspace_id null = gilt für alle Kunden.

export type DayKind = "feiertag" | "aktionstag" | "branche" | "kunde";
export type DayStatus = "aktiv" | "vorschlag" | "ausgeblendet";

export type MarketingDay = {
  id: string;
  workspace_id: string | null;
  /** YYYY-MM-DD (Kalendertag, ohne Zeitzone) */
  date: string;
  title: string;
  kind: DayKind;
  /** z. B. "DE", "HE"; null = international */
  region: string | null;
  note: string;
  status: DayStatus;
  /** Branchen, für die ein allgemeiner Tag gilt (leer = alle), siehe INDUSTRIES */
  industries: string[];
  /** "system" (Migration), "manuell", "ki" */
  source: string;
  created_at: string;
};

export const DAY_KINDS: Record<DayKind, { label: string; color: string }> = {
  feiertag: { label: "Feiertag", color: "#e5484d" },
  aktionstag: { label: "Aktionstag", color: "#8e6bd8" },
  branche: { label: "Branche", color: "#d9822b" },
  kunde: { label: "Kunde", color: "#0f9f8f" },
};

export const DAY_KIND_LIST = Object.keys(DAY_KINDS) as DayKind[];
export const DAY_STATUS_LIST: DayStatus[] = ["aktiv", "vorschlag", "ausgeblendet"];

/** Branchen-Schlagworte für allgemeine Branchentage (z. B. Tag des Croissants
 * nur bei Bäckereien und Cafés). Erkannt werden sie am Kunden über Branche,
 * Name und Briefing (Schlüsselwörter). */
export const INDUSTRIES: Record<string, { label: string; match: RegExp }> = {
  baeckerei: { label: "Bäckerei", match: /b(ä|ae)cker|backstube|backhaus|konditor|patisserie|brot/i },
  cafe: { label: "Café", match: /caf(é|e)\b|kaffee|r(ö|oe)ster|coffee/i },
  pizza: { label: "Pizzeria", match: /pizz/i },
  restaurant: { label: "Gastronomie", match: /restaurant|gastro|pizz|trattoria|osteria|bistro|imbiss|wirtshaus|gasthaus|küche|kueche|burger|catering/i },
};

/** Branchen, die im Text (Branche, Name, Briefing) erkennbar sind */
export const detectIndustries = (text: string) => Object.entries(INDUSTRIES).filter(([, { match }]) => match.test(text)).map(([key]) => key);

const pad = (n: number) => String(n).padStart(2, "0");

/** Lokales Datum → "YYYY-MM-DD" */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "YYYY-MM-DD" → lokales Datum (Mitternacht) */
export const parseDay = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Gültiges Kalenderdatum im Format YYYY-MM-DD? */
export function validDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isoDay(parseDay(value)) === value;
}

/** Basis-URL der Tage einer Kundenwelt (Präfix für mutate/revalidate) */
export const daysUrl = (workspaceId: string) => `/api/marketing/days?workspace=${encodeURIComponent(workspaceId)}`;
export const daysRangeUrl = (workspaceId: string, from: string, to: string) => `${daysUrl(workspaceId)}&from=${from}&to=${to}`;
