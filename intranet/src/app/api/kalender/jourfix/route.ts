import { withUser } from "@/lib/server/auth";
import { createJourFix, JourFixError, listJourFix, validate } from "@/lib/server/jourfix";

// Jour fixe (wiederkehrende Termine mit festem Meet-Link). Zugriff wie die
// übrigen Sales-Routen: angemeldet und Bereich „sales“.

const fail = (error: unknown) => {
  if (error instanceof JourFixError) return Response.json({ error: error.message }, { status: error.status });
  throw error;
};

/** Laufende Jour fixe, mit ?customer_id= nur die eines Kunden */
export const GET = withUser(async (_user, request) => {
  const customerId = new URL(request.url).searchParams.get("customer_id");
  return Response.json(await listJourFix(customerId));
}, ["sales"]);

/** Jour fixe anlegen: Raum und Outlook-Serie mit Einladung */
export const POST = withUser(async (user, request) => {
  try {
    const input = await validate(await request.json().catch(() => null), user);
    return Response.json(await createJourFix(input, user), { status: 201 });
  } catch (error) {
    return fail(error);
  }
}, ["sales"]);
