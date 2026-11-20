import { withUser } from "@/lib/server/auth";
import {
  defaultRange,
  isId,
  listEntries,
  NOTE_MAX,
  parseIso,
  runningEntry,
  startEntry,
  TimeError,
  type StartInput,
} from "@/lib/server/time";

// Zeiterfassung: jedes angemeldete Konto erfasst und sieht nur die eigene Zeit.

const fail = (error: unknown) => {
  if (error instanceof TimeError) return Response.json({ error: error.message }, { status: error.status });
  throw error;
};

const DAY = 86_400_000;

/** Eigene Einträge im Zeitraum (?from=&to=, ISO; Standard: diese Woche) und
 * der laufende Timer */
export const GET = withUser(async (user, request) => {
  const search = new URL(request.url).searchParams;
  const range = defaultRange();
  const from = search.has("from") ? parseIso(search.get("from")) : Date.parse(range.from);
  const to = search.has("to") ? parseIso(search.get("to")) : Date.parse(range.to);
  if (from === null || to === null) return Response.json({ error: "Zeitraum bitte als ISO-Datum mit Zeitzone." }, { status: 400 });
  if (to <= from) return Response.json({ error: "Das Ende des Zeitraums muss nach dem Beginn liegen." }, { status: 400 });
  if (to - from > 400 * DAY) return Response.json({ error: "Der Zeitraum ist zu lang (höchstens ein Jahr)." }, { status: 400 });

  const [entries, running] = await Promise.all([
    listEntries(user.email, new Date(from).toISOString(), new Date(to).toISOString()),
    runningEntry(user.email),
  ]);
  return Response.json({ entries, running });
});

/** Timer starten (ein laufender wird gestoppt). Body: { customer_id?, task_id?, note? } */
export const POST = withUser(async (user, request) => {
  const body = await request.json().catch(() => null);
  if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
    return Response.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const start: StartInput = {};

  for (const key of ["customer_id", "task_id"] as const) {
    const value = input[key];
    if (value === undefined || value === null || value === "") continue;
    if (!isId(value)) return Response.json({ error: key === "customer_id" ? "Ungültiger Kunde." : "Ungültige Aufgabe." }, { status: 400 });
    start[key] = value;
  }
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string") return Response.json({ error: "Notiz bitte als Text." }, { status: 400 });
    const note = input.note.trim();
    if (note.length > NOTE_MAX) return Response.json({ error: `Notiz höchstens ${NOTE_MAX} Zeichen.` }, { status: 400 });
    start.note = note;
  }

  try {
    return Response.json(await startEntry(user.email, start), { status: 201 });
  } catch (error) {
    return fail(error);
  }
});
