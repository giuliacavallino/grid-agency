import { withUser } from "@/lib/server/auth";
import { endJourFix, JourFixError } from "@/lib/server/jourfix";

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
