import { withMarketing } from "@/lib/server/social/auth";
import { getDesign } from "@/lib/server/social/canva";

type Context = { params: Promise<{ id: string }> };

/** Ein Design mit aktueller Bearbeiten-Adresse (edit_url läuft nach ca. 30 Tagen ab) */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return Response.json({ error: "Ungültige Design-ID" }, { status: 400 });
  return Response.json(await getDesign(id));
});
