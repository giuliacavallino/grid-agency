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

// ---------- Einstellungen je Akte (workspaces.settings.google) ----------

export type GoogleUpdateSettings = {
  to: string[];
  cc: string[];
  /** z. B. „Hallo Sabrina, hallo Kathrin,“ */
  greeting: string;
  /** Postfach, aus dem das Update geht (Entwurf/Senden) */
  mailbox: string;
  /** montags automatisch als Outlook-Entwurf anlegen */
  auto_draft: boolean;
  /** Abschnitt „Bewertungen“ je Standort */
  reviews: boolean;
};

export type GoogleSettings = { make_scenarios: number[]; update: GoogleUpdateSettings };

export const DEFAULT_UPDATE: GoogleUpdateSettings = { to: [], cc: [], greeting: "Hallo zusammen,", mailbox: "", auto_draft: false, reviews: false };

export function cleanGoogleSettings(raw: unknown): GoogleSettings {
  const g = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const u = (g.update && typeof g.update === "object" ? g.update : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)) : []);
  return {
    make_scenarios: Array.isArray(g.make_scenarios) ? g.make_scenarios.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [],
    update: {
      to: list(u.to),
      cc: list(u.cc),
      greeting: typeof u.greeting === "string" && u.greeting.trim() ? u.greeting.trim().slice(0, 200) : DEFAULT_UPDATE.greeting,
      mailbox: typeof u.mailbox === "string" ? u.mailbox.trim().toLowerCase() : "",
      auto_draft: u.auto_draft === true,
      reviews: u.reviews === true,
    },
  };
}

export type GoogleUpdateRow = {
  id: string;
  workspace_id: string;
  created_at: string;
  status: "draft" | "sent";
  sent_at: string | null;
  subject: string;
  to: string[];
  cc: string[];
  html: string;
  mailbox: string | null;
  sent_by: string | null;
};

// ---------- Wochen-Update (Mailtext) ----------

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const p = (html: string) => `<p style="margin:0 0 12px">${html}</p>`;

/** Betreff wie bisher: „Google Update 23.11. & offene Punkte“ */
export const updateSubject = (date = new Date()) =>
  `Google Update ${date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })} & offene Punkte`;

/** Mailtext im Stil der bisherigen Updates aus dem Google-Stand der Akte.
 * Nur, was der Kunde auch im Portal sieht (sichtbare To-dos, keine internen
 * Notizen). „Gute Nachrichten“ = seit dem letzten gesendeten Update erledigt. */
export function buildUpdate(board: GoogleBoard, settings: GoogleUpdateSettings, lastSentAt: string | null, date = new Date()) {
  const names = new Map(board.locations.map((l) => [l.id, l.name]));
  const visible = board.todos.filter((t) => t.visible);
  const open = visible.filter((t) => t.status !== "erledigt");
  const since = lastSentAt ? Date.parse(lastSentAt) : date.getTime() - 7 * 86_400_000;
  const done = visible.filter((t) => t.status === "erledigt" && Date.parse(t.done_at ?? t.updated_at) > since);
  const item = (t: GoogleTodo) => {
    const where = t.location_id ? names.get(t.location_id) : null;
    const lead = where ? `<strong style='font-weight:700'>${esc(where)}:</strong> ` : "";
    const text = t.note ? `${esc(t.title)}. ${esc(t.note)}` : esc(t.title);
    return p(`${lead}${text}`);
  };

  const parts = [p(esc(settings.greeting)), p("ich hoffe, ihr seid gut in die neue Woche gestartet! Hier der aktuelle Stand.")];
  if (done.length) {
    parts.push(p("<strong style='font-weight:700'>Gute Nachrichten:</strong>"));
    for (const t of done) parts.push(p(`${t.location_id && names.get(t.location_id) ? `<strong style='font-weight:700'>${esc(names.get(t.location_id)!)}:</strong> ` : ""}${esc(t.title)} ✓`));
  }
  const customer = open.filter((t) => t.owner === "kunde");
  if (customer.length) {
    parts.push(p("<strong style='font-weight:700'>Was wir noch von euch brauchen:</strong>"));
    customer.forEach((t) => parts.push(item(t)));
  }
  const ours = open.filter((t) => t.owner !== "kunde");
  if (ours.length) {
    parts.push(p("<strong style='font-weight:700'>Was bei uns läuft:</strong>"));
    ours.forEach((t) => parts.push(item(t)));
  }
  if (settings.reviews) {
    const rated = board.locations.filter((l) => l.status !== "archiviert" && l.rating != null);
    if (rated.length) {
      const stats = googleStats(board);
      parts.push(p(`<strong style='font-weight:700'>Bewertungen</strong> (Ø ${formatRating(stats.rating)} ★ aus ${stats.reviews.toLocaleString("de-DE")} Bewertungen):`));
      const rows = rated
        .sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
        .map((l) => {
          const gained = l.start_reviews != null && l.reviews != null ? l.reviews - l.start_reviews : null;
          return `<li>${esc(l.name)}: ${formatRating(l.rating)} ★ (${l.reviews ?? 0})${gained ? `, ${gained > 0 ? "+" : ""}${gained} seit Start` : ""}</li>`;
        })
        .join("");
      parts.push(`<ul style="margin:0 0 12px;padding-left:18px">${rows}</ul>`);
    }
  }
  parts.push(p("Bei Fragen meldet euch gerne jederzeit!"), p("Liebe Grüße"));
  return { subject: updateSubject(date), html: parts.join("\n") };
}

// ---------- Automationen (Make) ----------

export type AutomationRun = { id: string; at: string; status: "ok" | "warnung" | "fehler" | "laeuft"; duration: number | null; operations: number | null; error: string | null };

export type Automation = {
  id: number;
  name: string;
  active: boolean;
  /** Zeitplan in Worten, z. B. „Mo–Fr 08:15“ */
  schedule: string;
  next_run: string | null;
  url: string;
  runs: AutomationRun[];
  error?: string;
};

export type AutomationsView = { configured: boolean; scenarios: Automation[] };
