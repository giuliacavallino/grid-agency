import { withUser } from "@/lib/server/auth";
import { getBilling } from "@/lib/server/billing";

type Context = { params: Promise<{ id: string }> };

/** Ein Beleg mit Positionen, Zahlungen, verknüpften Belegen und PDF-Link */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  const doc = await getBilling(id);
  return doc ? Response.json(doc) : Response.json({ error: "Nicht gefunden" }, { status: 404 });
});
