import { withMarketing } from "@/lib/server/social/auth";
import { getWorkspace } from "@/lib/server/social/store";
import { createItem, getBoard, googleFail as fail, kindOf } from "@/lib/server/google";

type Context = { params: Promise<{ id: string }> };

/** Google-Stand der Akte: { locations, todos } */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await getBoard(id), { headers: { "Cache-Control": "no-store" } });
});

/** { kind: "location" | "todo", ...Felder } anlegen; liefert den ganzen Stand */
export const POST = withMarketing(async (actor, request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const kind = kindOf(body.kind);
  if (!kind) return Response.json({ error: "kind fehlt (location oder todo)" }, { status: 400 });
  try {
    return Response.json(await createItem(id, kind, body, actor.email));
  } catch (error) {
    return fail(error);
  }
});
