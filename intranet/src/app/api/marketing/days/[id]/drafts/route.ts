import { withMarketing } from "@/lib/server/social/auth";
import { draftsForDay } from "@/lib/server/social/day-autopilot";
import { getWorkspace } from "@/lib/server/social/store";

// Claude + mehrere Canva-Designs: bis zu ein paar Minuten
export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/** Entwürfe (Post bzw. Karussell und Story) zu diesem Tag sofort anlegen: { workspace_id } */
export const POST = withMarketing(async (_actor, request, { params }: Context) => {
  const body = (await request.json()) as { workspace_id?: string };
  if (!body.workspace_id || !(await getWorkspace(body.workspace_id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  try {
    return Response.json(await draftsForDay(body.workspace_id, (await params).id), { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});
