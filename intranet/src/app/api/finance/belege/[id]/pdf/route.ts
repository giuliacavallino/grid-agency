import { withUser } from "@/lib/server/auth";
import { billingPdfUrl } from "@/lib/server/billing";

type Context = { params: Promise<{ id: string }> };

/** Frischer, 10 Minuten gültiger Link auf das PDF eines Belegs */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  const url = await billingPdfUrl(id);
  return url ? Response.json({ url }) : Response.json({ error: "Kein PDF vorhanden" }, { status: 404 });
});
