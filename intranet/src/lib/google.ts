// Google-Betreuung je Kundenakte: Unternehmensprofile (Standorte) mit Status
// und Bewertungen sowie To-dos mit Zuständigkeit (GRID, Kunde, Google).
// Intern pflegt das Team alles in der Akte, das Kundenportal zeigt denselben
// Stand ohne interne Notizen und ohne ausgeblendete Punkte.

export type LocationStatus = "anlage" | "zugriff" | "nachweis" | "verifizierung" | "pruefung" | "live" | "gesperrt" | "archiviert";
export type TodoStatus = "offen" | "in_arbeit" | "wartet" | "erledigt";
export type TodoOwner = "grid" | "kunde" | "google";
export type Tone = "success" | "warn" | "action" | "neutral" | "muted" | "error";

export const LOCATION_STATUS: Record<LocationStatus, { label: string; hint: string; tone: Tone }> = {
  anlage: { label: "Wird angelegt", hint: "Profil wird eingerichtet", tone: "neutral" },
  zugriff: { label: "Zugriff fehlt", hint: "Inhaber- oder Verwaltungsrechte sind angefragt", tone: "action" },
  nachweis: { label: "Nachweis fehlt", hint: "Google braucht einen Nachweis (z. B. Mietvertrag, Rechnung)", tone: "action" },
  verifizierung: { label: "Verifizierung", hint: "Bestätigung bei Google läuft", tone: "warn" },
  pruefung: { label: "In Prüfung", hint: "Google prüft die Angaben", tone: "warn" },
  live: { label: "Live", hint: "Profil ist bestätigt und online", tone: "success" },
  gesperrt: { label: "Gesperrt", hint: "Google hat das Profil eingeschränkt", tone: "error" },
  archiviert: { label: "Archiviert", hint: "Doppelt oder nicht mehr aktiv", tone: "muted" },
};

export const TODO_STATUS: Record<TodoStatus, { label: string; tone: Tone }> = {
  offen: { label: "Offen", tone: "neutral" },
  in_arbeit: { label: "In Arbeit", tone: "warn" },
  wartet: { label: "Wartet", tone: "muted" },
  erledigt: { label: "Erledigt", tone: "success" },
};

export const TODO_OWNER: Record<TodoOwner, { label: string; customer: string }> = {
  grid: { label: "GRID", customer: "GRID" },
  kunde: { label: "Kunde", customer: "Ihr" },
  google: { label: "Google", customer: "Google" },
};

export type GoogleLocation = {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  brand: string | null;
  address: string | null;
  maps_url: string | null;
  status: LocationStatus;
  rating: number | null;
  reviews: number | null;
  rating_at: string | null;
  /** Stand zu Betreuungsbeginn, für „seit Start“ */
  start_rating: number | null;
  start_reviews: number | null;
  /** sieht der Kunde */
  note: string | null;
  internal_note: string | null;
  sort: number;
};

export type GoogleTodo = {
  id: string;
  workspace_id: string;
  location_id: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  owner: TodoOwner;
  status: TodoStatus;
  due: string | null;
  /** sieht der Kunde */
  note: string | null;
  internal_note: string | null;
  /** im Kundenportal anzeigen */
  visible: boolean;
  done_at: string | null;
  created_by: string | null;
  sort: number;
};

export type GoogleBoard = { locations: GoogleLocation[]; todos: GoogleTodo[] };

/** Was das Kundenportal bekommt: ohne interne Felder */
export type PortalGoogleLocation = Omit<GoogleLocation, "internal_note" | "workspace_id" | "created_at" | "sort">;
export type PortalGoogleTodo = Omit<GoogleTodo, "internal_note" | "workspace_id" | "visible" | "created_by" | "created_at" | "sort">;
export type PortalGoogle = { locations: PortalGoogleLocation[]; todos: PortalGoogleTodo[]; updated_at: string | null };

export const LOCATION_FIELDS = ["name", "brand", "address", "maps_url", "status", "rating", "reviews", "rating_at", "start_rating", "start_reviews", "note", "internal_note", "sort"] as const;
export const TODO_FIELDS = ["location_id", "title", "owner", "status", "due", "note", "internal_note", "visible", "sort"] as const;

/** Kennzahlen für Kopfzeile (intern und Portal) */
export function googleStats(board: { locations: Pick<GoogleLocation, "status" | "rating" | "reviews" | "start_reviews">[]; todos: Pick<GoogleTodo, "owner" | "status">[] }) {
  const active = board.locations.filter((l) => l.status !== "archiviert");
  const rated = active.filter((l) => l.rating != null && (l.reviews ?? 0) > 0);
  const reviews = rated.reduce((sum, l) => sum + (l.reviews ?? 0), 0);
  // Ø gewichtet nach Anzahl Bewertungen, wie Google bei mehreren Standorten
  const rating = reviews ? rated.reduce((sum, l) => sum + (l.rating ?? 0) * (l.reviews ?? 0), 0) / reviews : null;
  const withStart = rated.filter((l) => l.start_reviews != null);
  const gained = withStart.length ? withStart.reduce((sum, l) => sum + ((l.reviews ?? 0) - (l.start_reviews ?? 0)), 0) : null;
  const open = board.todos.filter((t) => t.status !== "erledigt");
  return {
    total: active.length,
    live: active.filter((l) => l.status === "live").length,
    blocked: active.filter((l) => LOCATION_STATUS[l.status].tone === "action" || l.status === "gesperrt").length,
    rating,
    reviews,
    gained,
    openCustomer: open.filter((t) => t.owner === "kunde").length,
    openGrid: open.filter((t) => t.owner === "grid").length,
    openGoogle: open.filter((t) => t.owner === "google").length,
  };
}

export const formatRating = (value: number | null | undefined) => (value == null ? "–" : value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
