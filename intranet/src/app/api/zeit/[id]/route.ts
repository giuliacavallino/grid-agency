import { withUser } from "@/lib/server/auth";
import { deleteEntry, isId, NOTE_MAX, parseIso, stopEntry, TimeError, updateEntry, type EntryPatch } from "@/lib/server/time";

type Context = { params: Promise<{ id: string }> };

const fail = (error: unknown) => {
  if (error instanceof TimeError) return Response.json({ error: error.message }, { status: error.status });
  throw error;
};

const bad = (error: string) => Response.json({ error }, { status: 400 });

/** Timer stoppen ({ stop: true }) oder Eintrag ändern
 * ({ note?, customer_id?, started_at?, ended_at? }) */
export const PATCH = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  if (!isId(id)) return Response.json({ error: "Eintrag nicht gefunden." }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return bad("Ungültige Anfrage.");
  const input = body as Record<string, unknown>;

  try {
    if (input.stop === true) return Response.json(await stopEntry(user.email, id));

    const patch: EntryPatch = {};
    if (input.note !== undefined) {
      if (typeof input.note !== "string") return bad("Notiz bitte als Text.");
      const note = input.note.trim();
      if (note.length > NOTE_MAX) return bad(`Notiz höchstens ${NOTE_MAX} Zeichen.`);
      patch.note = note;
    }
    if (input.customer_id !== undefined) {
      if (input.customer_id === null || input.customer_id === "") patch.customer_id = null;
      else if (isId(input.customer_id)) patch.customer_id = input.customer_id;
      else return bad("Ungültiger Kunde.");
    }
    const now = Date.now();
    if (input.started_at !== undefined) {
      const ms = parseIso(input.started_at);
      if (ms === null) return bad("Beginn bitte als ISO-Datum mit Zeitzone.");
      if (ms > now + 60_000) return bad("Der Beginn liegt in der Zukunft.");
      patch.started_at = new Date(ms).toISOString();
    }
    if (input.ended_at !== undefined) {
      const ms = parseIso(input.ended_at);
      if (ms === null) return bad("Ende bitte als ISO-Datum mit Zeitzone.");
      if (ms > now + 60_000) return bad("Das Ende liegt in der Zukunft.");
      patch.ended_at = new Date(ms).toISOString();
    }
    if (patch.started_at && patch.ended_at && patch.ended_at <= patch.started_at) {
      return bad("Das Ende muss nach dem Beginn liegen.");
    }
    return Response.json(await updateEntry(user.email, id, patch));
  } catch (error) {
    return fail(error);
  }
});

export const DELETE = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  if (!isId(id)) return Response.json({ error: "Eintrag nicht gefunden." }, { status: 404 });
  try {
    await deleteEntry(user.email, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return fail(error);
  }
});
