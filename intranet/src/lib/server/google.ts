import "server-only";
import { DEMO } from "@/lib/config";
import {
  LOCATION_FIELDS,
  LOCATION_STATUS,
  TODO_FIELDS,
  TODO_OWNER,
  TODO_STATUS,
  type GoogleBoard,
  type GoogleLocation,
  type GoogleTodo,
  type PortalGoogle,
} from "@/lib/google";
import { check } from "./billing";
import { sb } from "./db";

// Google-Betreuung je Kundenakte (Tabellen google_locations, google_todos).

export class GoogleError extends Error {}

// ---------- Vorschau ohne Datenbank ----------

const now = () => new Date().toISOString();
let seq = 0;
const demo: GoogleBoard = { locations: [], todos: [] };

// ---------- Eingaben säubern ----------

const text = (value: unknown, max = 2000) => {
  if (value == null) return null;
  const s = String(value).trim().slice(0, max);
  return s || null;
};
const dateOnly = (value: unknown) => {
  const s = text(value, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
const stars = (value: unknown) => {
  if (value == null || value === "") return null;
  const n = Math.round(Number(String(value).replace(",", ".")) * 10) / 10;
  if (!Number.isFinite(n) || n < 1 || n > 5) throw new GoogleError("Bewertung bitte zwischen 1,0 und 5,0");
  return n;
};
const count = (value: unknown) => {
  if (value == null || value === "") return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) throw new GoogleError("Anzahl Bewertungen bitte als Zahl ab 0");
  return n;
};
const url = (value: unknown) => {
  const s = text(value, 1000);
  if (!s) return null;
  if (!/^https:\/\//i.test(s)) throw new GoogleError("Link bitte mit https:// angeben");
  return s;
};

function cleanLocation(input: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  for (const key of LOCATION_FIELDS) {
    if (!(key in input)) continue;
    const v = input[key];
    if (key === "status") {
      if (!(String(v) in LOCATION_STATUS)) throw new GoogleError("Unbekannter Status");
      out.status = String(v);
    } else if (key === "rating" || key === "start_rating") out[key] = stars(v);
    else if (key === "reviews" || key === "start_reviews") out[key] = count(v);
    else if (key === "rating_at") out[key] = dateOnly(v);
    else if (key === "maps_url") out[key] = url(v);
    else if (key === "sort") out[key] = Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0;
    else out[key] = text(v, key === "name" ? 200 : 2000);
  }
  if (!partial && !out.name) throw new GoogleError("Bitte einen Namen für den Standort angeben");
  if ("name" in out && !out.name) throw new GoogleError("Der Name darf nicht leer sein");
  // Neue Bewertungszahlen ohne Datum: heute als Stand
  if (("rating" in out || "reviews" in out) && !("rating_at" in input)) out.rating_at = now().slice(0, 10);
  return out;
}

function cleanTodo(input: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  for (const key of TODO_FIELDS) {
    if (!(key in input)) continue;
    const v = input[key];
    if (key === "status") {
      if (!(String(v) in TODO_STATUS)) throw new GoogleError("Unbekannter Status");
      out.status = String(v);
    } else if (key === "owner") {
      if (!(String(v) in TODO_OWNER)) throw new GoogleError("Unbekannte Zuständigkeit");
      out.owner = String(v);
    } else if (key === "visible") out.visible = v !== false && v !== "false";
    else if (key === "due") out.due = dateOnly(v);
    else if (key === "location_id") out.location_id = text(v, 64);
    else if (key === "sort") out[key] = Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0;
    else out[key] = text(v, key === "title" ? 300 : 2000);
  }
  if (!partial && !out.title) throw new GoogleError("Bitte einen Titel angeben");
  if ("title" in out && !out.title) throw new GoogleError("Der Titel darf nicht leer sein");
  if ("status" in out) out.done_at = out.status === "erledigt" ? now() : null;
  return out;
}

// ---------- Lesen ----------

/** Beispieldaten für die Vorschau, einmal je Kundenwelt */
const seeded = new Set<string>();
function seedDemo(workspaceId: string) {
  if (seeded.has(workspaceId)) return;
  seeded.add(workspaceId);
  const base = () => ({ id: `demo-g${++seq}`, workspace_id: workspaceId, created_at: now(), updated_at: now(), maps_url: null, rating_at: now().slice(0, 10), internal_note: null });
  const loc = (name: string, brand: string, status: GoogleLocation["status"], rating: number | null, reviews: number | null, start: number | null, note: string | null, sort: number): GoogleLocation => ({
    ...base(), name, brand, address: "Flughafen Frankfurt T1", status, rating, reviews, start_rating: rating, start_reviews: start, note, sort,
  });
  const a = loc("Quicker's Gate A23", "Quicker's", "live", 4.2, 318, 290, "Seit 22.10. live.", 1);
  const b = loc("Mondo Bar C14", "Mondo", "verifizierung", null, null, null, "Zur Bestätigung fehlt noch das Live-Video vor Ort.", 2);
  const c = loc("Slim Chickens DUS", "Slim Chickens", "nachweis", 3.9, 41, 38, "Für den Google-Support fehlen Gewerbeanmeldung und Versorgerrechnung.", 3);
  const d = loc("Hermann's Mobil A16", "Hermann's", "live", 4.5, 127, 119, null, 4);
  demo.locations.push(a, b, c, d);
  const todo = (title: string, owner: GoogleTodo["owner"], status: GoogleTodo["status"], location: GoogleLocation | null, note: string | null, sort: number): GoogleTodo => ({
    ...base(), location_id: location?.id ?? null, title, owner, status, due: null, note, visible: true, done_at: status === "erledigt" ? now() : null, created_by: "vorschau", sort,
  });
  demo.todos.push(
    todo("Live-Video Mondo Bar C14 aufnehmen", "kunde", "offen", b, "Ca. 30 Sekunden live in der Google-Maps-App: Gate-Schild, Logo, Theke, Kasse.", 1),
    todo("Gewerbeanmeldung + Versorgerrechnung liefern", "kunde", "wartet", c, null, 2),
    todo("Beim Google-Support nachhaken", "grid", "wartet", c, null, 3),
    todo("Prüfung der Öffnungszeiten", "google", "in_arbeit", null, null, 4),
    todo("Öffnungszeiten aller Profile aktualisiert", "grid", "erledigt", null, null, 5)
  );
}

export async function getBoard(workspaceId: string): Promise<GoogleBoard> {
  if (DEMO) {
    seedDemo(workspaceId);
    return { locations: demo.locations.filter((l) => l.workspace_id === workspaceId), todos: demo.todos.filter((t) => t.workspace_id === workspaceId) };
  }
  const [locations, todos] = await Promise.all([
    sb().from("google_locations").select("*").eq("workspace_id", workspaceId).order("sort").order("name"),
    sb().from("google_todos").select("*").eq("workspace_id", workspaceId).order("sort").order("created_at"),
  ]);
  return {
    locations: (check(locations) as GoogleLocation[]).map((l) => ({ ...l, rating: l.rating == null ? null : Number(l.rating), start_rating: l.start_rating == null ? null : Number(l.start_rating) })),
    todos: check(todos) as GoogleTodo[],
  };
}

/** Stand fürs Kundenportal: ohne interne Notizen und ausgeblendete To-dos.
 * Erledigtes nur aus den letzten 60 Tagen. */
export async function portalGoogle(workspaceId: string): Promise<PortalGoogle | null> {
  const board = await getBoard(workspaceId);
  if (!board.locations.length && !board.todos.length) return null;
  const since = Date.now() - 60 * 86_400_000;
  const locations = board.locations
    .filter((l) => l.status !== "archiviert")
    .map((l) => ({ id: l.id, updated_at: l.updated_at, name: l.name, brand: l.brand, address: l.address, maps_url: l.maps_url, status: l.status, rating: l.rating, reviews: l.reviews, rating_at: l.rating_at, start_rating: l.start_rating, start_reviews: l.start_reviews, note: l.note }));
  const todos = board.todos
    .filter((t) => t.visible && (t.status !== "erledigt" || Date.parse(t.done_at ?? t.updated_at) >= since))
    .map((t) => ({ id: t.id, location_id: t.location_id, updated_at: t.updated_at, title: t.title, owner: t.owner, status: t.status, due: t.due, note: t.note, done_at: t.done_at }));
  const stamps = [...board.locations.map((l) => l.updated_at), ...board.todos.map((t) => t.updated_at)].sort();
  return { locations, todos, updated_at: stamps.at(-1) ?? null };
}

// ---------- Schreiben ----------

export type Kind = "location" | "todo";
export const kindOf = (value: unknown): Kind | null => (value === "location" || value === "todo" ? value : null);

/** Eingabefehler als 400, alles andere weiterwerfen */
export function googleFail(error: unknown) {
  if (error instanceof GoogleError) return Response.json({ error: error.message }, { status: 400 });
  throw error;
}
const TABLE: Record<Kind, string> = { location: "google_locations", todo: "google_todos" };

async function assertLocation(workspaceId: string, locationId: unknown) {
  if (!locationId) return;
  const board = await getBoard(workspaceId);
  if (!board.locations.some((l) => l.id === locationId)) throw new GoogleError("Standort gehört nicht zu dieser Akte");
}

export async function createItem(workspaceId: string, kind: Kind, input: Record<string, unknown>, by: string) {
  const values = kind === "location" ? cleanLocation(input, false) : { ...cleanTodo(input, false), created_by: by };
  if (kind === "todo") await assertLocation(workspaceId, values.location_id);
  if (DEMO) {
    const base = { id: `demo-g${++seq}`, workspace_id: workspaceId, created_at: now(), updated_at: now(), sort: 0 };
    if (kind === "location") {
      demo.locations.push({ brand: null, address: null, maps_url: null, status: "anlage", rating: null, reviews: null, rating_at: null, start_rating: null, start_reviews: null, note: null, internal_note: null, ...base, ...values } as GoogleLocation);
    } else {
      demo.todos.push({ location_id: null, owner: "grid", status: "offen", due: null, note: null, internal_note: null, visible: true, done_at: null, created_by: by, ...base, ...values } as GoogleTodo);
    }
    return getBoard(workspaceId);
  }
  check(await sb().from(TABLE[kind]).insert({ ...values, workspace_id: workspaceId }));
  return getBoard(workspaceId);
}

export async function updateItem(workspaceId: string, kind: Kind, id: string, input: Record<string, unknown>) {
  const values = kind === "location" ? cleanLocation(input, true) : cleanTodo(input, true);
  if (kind === "todo" && "location_id" in values) await assertLocation(workspaceId, values.location_id);
  if (DEMO) {
    const list: { id: string; workspace_id: string }[] = kind === "location" ? demo.locations : demo.todos;
    const row = list.find((r) => r.id === id && r.workspace_id === workspaceId);
    if (!row) throw new GoogleError("Nicht gefunden");
    Object.assign(row, values, { updated_at: now() });
    return getBoard(workspaceId);
  }
  const result = check(await sb().from(TABLE[kind]).update({ ...values, updated_at: now() }).eq("workspace_id", workspaceId).eq("id", id).select("id")) as { id: string }[];
  if (!result.length) throw new GoogleError("Nicht gefunden");
  return getBoard(workspaceId);
}

export async function deleteItem(workspaceId: string, kind: Kind, id: string) {
  if (DEMO) {
    if (kind === "location") demo.locations = demo.locations.filter((r) => r.id !== id);
    else demo.todos = demo.todos.filter((r) => r.id !== id);
    return getBoard(workspaceId);
  }
  check(await sb().from(TABLE[kind]).delete().eq("workspace_id", workspaceId).eq("id", id));
  return getBoard(workspaceId);
}
