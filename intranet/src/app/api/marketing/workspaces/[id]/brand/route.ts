import { agentBrief, type Brand } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { getBrand, getWorkspace, updateBrand } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

/** CI-Welt der Kundenwelt, dazu die fertige Vorgabe für den Agenten (brief) */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  const workspace = await getWorkspace(id);
  if (!workspace) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const brand = await getBrand(id);
  return Response.json({ brand, brief: agentBrief(workspace.name, brand) });
});

/** CI-Welt ändern (nur übergebene Felder); nur Menschen, der Agent liest sie */
export const PATCH = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    const workspace = await getWorkspace(id);
    if (!workspace) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const brand = await updateBrand(id, (await request.json()) as Partial<Brand>);
    return Response.json({ brand, brief: agentBrief(workspace.name, brand) });
  },
  { agent: false }
);
