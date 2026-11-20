import { withUser } from "@/lib/server/auth";
import { endJourFix, JourFixError, updateJourFix, validate } from "@/lib/server/jourfix";

type Context = { params: Promise<{ id: string }> };

/** Jour fixe beenden: Serie endet heute, der Link ist danach zu */
export const DELETE = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  try {
    await endJourFix(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof JourFixError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}, ["sales"]);

/** Jour fixe ändern (gleiche Eingaben wie beim Anlegen); Outlook schickt die Änderung */
export const PATCH = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  try {
    // Organisator bleibt beim Bearbeiten fest (Outlook-Serie liegt in dessen Postfach)
    const body = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    const input = await validate({ ...body, mailbox: undefined }, user);
    return Response.json(await updateJourFix(id, input));
  } catch (error) {
    if (error instanceof JourFixError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}, ["sales"]);
