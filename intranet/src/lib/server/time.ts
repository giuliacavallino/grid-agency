import "server-only";
import { randomUUID } from "node:crypto";
import { DEMO } from "@/lib/config";
import { berlinWall, fromBerlin } from "@/lib/jourfix";
import { db, sb } from "./db";

// Zeiterfassung (Kopfleiste): Zeitblöcke je Person. ended_at null = Timer
// läuft. Jede Person sieht und ändert nur ihre eigenen Einträge. Im
// Vorschaumodus liegen die Einträge im Arbeitsspeicher.

export type TimeEntry = {
  id: string;
  created_at: string;
  user_email: string;
  started_at: string;
  ended_at: string | null;
  customer_id: string | null;
  task_id: string | null;
  note: string;
  /** Name des Kunden, vom Server ergänzt */
  customer_name: string | null;
};

type EntryRow = Omit<TimeEntry, "customer_name">;

export type StartInput = { customer_id?: string | null; task_id?: string | null; note?: string };
export type EntryPatch = Partial<{ note: string; customer_id: string | null; started_at: string; ended_at: string }>;

export class TimeError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export const NOTE_MAX = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Gültige ID; in der Vorschau haben Beispieldaten IDs wie „demo-0001“ */
export const isId = (value: unknown): value is string =>
  typeof value === "string" && (UUID.test(value) || (DEMO && /^demo-[\w-]{1,40}$/.test(value)));

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;
/** ISO-Zeitpunkt mit Zeitzone → Millisekunden, sonst null */
export function parseIso(value: unknown) {
  if (typeof value !== "string" || !ISO.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Montag 00:00 der laufenden Woche in Berlin bis morgen */
export function defaultRange(now = Date.now()) {
  const wall = new Date(berlinWall(now));
  const weekday = (wall.getUTCDay() + 6) % 7; // Montag = 0
  const monday = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - weekday));
  const from = fromBerlin(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0);
  return { from: new Date(from).toISOString(), to: new Date(now + 86_400_000).toISOString() };
}

// ---------- Speicher ----------

function check<T>({ data, error }: { data: T; error: { message: string; code?: string } | null }) {
  if (error) {
    if (error.code === "23505") throw new TimeError("Es läuft schon ein Timer.", 409);
    if (error.code === "23514") throw new TimeError("Das Ende muss nach dem Beginn liegen.");
    throw new Error(error.message);
  }
  return data;
}

const demo: EntryRow[] = [];
let seeded = false;

/** Zwei Beispieleinträge von heute Vormittag, damit die Liste nicht leer ist */
async function demoRows(email: string) {
  if (!seeded) {
    seeded = true;
    const customers = await db().list("customers");
    const today = new Date(berlinWall(Date.now()));
    const at = (hour: number, minute: number) =>
      new Date(fromBerlin(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate(), hour, minute)).toISOString();
    if (Date.parse(at(10, 45)) < Date.now()) {
      demo.push(
        { id: randomUUID(), created_at: at(9, 0), user_email: email, started_at: at(9, 0), ended_at: at(9, 50), customer_id: customers[0]?.id ?? null, task_id: null, note: "Content-Plan November" },
        { id: randomUUID(), created_at: at(10, 0), user_email: email, started_at: at(10, 0), ended_at: at(10, 45), customer_id: customers[1]?.id ?? null, task_id: null, note: "Abstimmung Shooting" }
      );
    }
  }
  return demo.filter((row) => row.user_email === email);
}

const byStartDesc = (a: EntryRow, b: EntryRow) => b.started_at.localeCompare(a.started_at);

/** Kundennamen ergänzen */
async function withCustomers(rows: EntryRow[]): Promise<TimeEntry[]> {
  const ids = [...new Set(rows.map((row) => row.customer_id).filter((id): id is string => !!id))];
  const customers = ids.length ? await db().list("customers", {}, ids) : [];
  const names = new Map(customers.map((c) => [c.id, String(c.name ?? "")]));
  return rows.map((row) => ({ ...row, customer_name: row.customer_id ? (names.get(row.customer_id) ?? null) : null }));
}

async function findOwn(email: string, id: string): Promise<EntryRow | null> {
  if (DEMO) return (await demoRows(email)).find((row) => row.id === id) ?? null;
  return check(
    await sb().from("time_entries").select("*").eq("id", id).eq("user_email", email).maybeSingle()
  ) as EntryRow | null;
}

async function patchOwn(email: string, id: string, patch: Partial<EntryRow>): Promise<EntryRow> {
  if (DEMO) {
    const row = (await demoRows(email)).find((r) => r.id === id);
    if (!row) throw new TimeError("Eintrag nicht gefunden.", 404);
    Object.assign(row, patch);
    return row;
  }
  const row = check(
    await sb().from("time_entries").update(patch).eq("id", id).eq("user_email", email).select().maybeSingle()
  ) as EntryRow | null;
  if (!row) throw new TimeError("Eintrag nicht gefunden.", 404);
  return row;
}

async function ensureCustomer(id: string | null | undefined) {
  if (id && !(await db().get("customers", id))) throw new TimeError("Diesen Kunden gibt es nicht.");
}

// ---------- Funktionen für die API ----------

/** Einträge, die im Zeitraum [from, to) beginnen, neueste zuerst */
export async function listEntries(email: string, from: string, to: string) {
  if (DEMO) {
    const rows = (await demoRows(email))
      .filter((row) => Date.parse(row.started_at) >= Date.parse(from) && Date.parse(row.started_at) < Date.parse(to))
      .sort(byStartDesc);
    return withCustomers(rows);
  }
  const rows = check(
    await sb()
      .from("time_entries")
      .select("*")
      .eq("user_email", email)
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at", { ascending: false })
      .limit(1000)
  ) as EntryRow[];
  return withCustomers(rows);
}

/** Laufender Timer der Person oder null */
export async function runningEntry(email: string) {
  let row: EntryRow | null;
  if (DEMO) row = (await demoRows(email)).find((r) => r.ended_at === null) ?? null;
  else {
    row = check(
      await sb().from("time_entries").select("*").eq("user_email", email).is("ended_at", null).maybeSingle()
    ) as EntryRow | null;
  }
  return row ? (await withCustomers([row]))[0] : null;
}

/** Neuen Timer starten; ein laufender wird vorher gestoppt */
export async function startEntry(email: string, input: StartInput) {
  await ensureCustomer(input.customer_id);
  const running = await runningEntry(email);
  if (running) await stopEntry(email, running.id);
  const now = new Date().toISOString();

  const values = {
    user_email: email,
    started_at: now,
    ended_at: null,
    customer_id: input.customer_id ?? null,
    task_id: input.task_id ?? null,
    note: input.note ?? "",
  };
  let row: EntryRow;
  if (DEMO) {
    row = { id: randomUUID(), created_at: now, ...values };
    demo.push(row);
  } else {
    row = check(await sb().from("time_entries").insert(values).select().single()) as EntryRow;
  }
  return (await withCustomers([row]))[0];
}

/** Laufenden Timer stoppen */
export async function stopEntry(email: string, id: string) {
  const row = await findOwn(email, id);
  if (!row) throw new TimeError("Eintrag nicht gefunden.", 404);
  if (row.ended_at) throw new TimeError("Dieser Timer ist schon gestoppt.", 409);
  const now = Date.now();
  // Mindestens eine Sekunde, damit Ende > Beginn gilt
  const ended = Math.max(now, Date.parse(row.started_at) + 1000);
  return (await withCustomers([await patchOwn(email, id, { ended_at: new Date(ended).toISOString() })]))[0];
}

/** Notiz, Kunde oder Zeiten ändern (Werte sind in der Route geprüft) */
export async function updateEntry(email: string, id: string, patch: EntryPatch) {
  const row = await findOwn(email, id);
  if (!row) throw new TimeError("Eintrag nicht gefunden.", 404);
  if (patch.customer_id !== undefined) await ensureCustomer(patch.customer_id);

  const started = Date.parse(patch.started_at ?? row.started_at);
  const endedAt = patch.ended_at ?? row.ended_at;
  if (endedAt && Date.parse(endedAt) <= started) throw new TimeError("Das Ende muss nach dem Beginn liegen.");
  if (!endedAt && started > Date.now()) throw new TimeError("Der Beginn liegt in der Zukunft.");

  const values: Partial<EntryRow> = {};
  if (patch.note !== undefined) values.note = patch.note;
  if (patch.customer_id !== undefined) values.customer_id = patch.customer_id;
  if (patch.started_at !== undefined) values.started_at = new Date(started).toISOString();
  if (patch.ended_at !== undefined) values.ended_at = new Date(Date.parse(patch.ended_at)).toISOString();
  if (!Object.keys(values).length) return (await withCustomers([row]))[0];
  return (await withCustomers([await patchOwn(email, id, values)]))[0];
}

export async function deleteEntry(email: string, id: string) {
  if (DEMO) {
    const index = demo.findIndex((row) => row.id === id && row.user_email === email);
    if (index < 0) throw new TimeError("Eintrag nicht gefunden.", 404);
    demo.splice(index, 1);
    return;
  }
  const rows = check(
    await sb().from("time_entries").delete().eq("id", id).eq("user_email", email).select("id")
  ) as { id: string }[];
  if (!rows.length) throw new TimeError("Eintrag nicht gefunden.", 404);
}
