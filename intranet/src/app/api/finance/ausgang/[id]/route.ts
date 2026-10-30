import { withUser } from "@/lib/server/auth";
import { getBilling } from "@/lib/server/billing";
import { BillingError, deleteDraft, saveDraft } from "@/lib/server/billing-write";

type Context = { params: Promise<{ id: string }> };

/** Ein Beleg mit Positionen, Zahlungen und verknüpften Belegen */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  const doc = await getBilling(id);
  return doc ? Response.json(doc) : Response.json({ error: "Nicht gefunden" }, { status: 404 });
}, ["finance"]);

/** Entwurf oder Serie ändern (festgeschriebene Belege sperrt die Datenbank) */
export const PATCH = withUser(async (_user, request, { params }: Context) => {
  const { id } = await params;
  try {
    await saveDraft(id, await request.json());
    return Response.json(await getBilling(id));
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}, ["finance"]);

export const DELETE = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  try {
    await deleteDraft(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}, ["finance"]);
