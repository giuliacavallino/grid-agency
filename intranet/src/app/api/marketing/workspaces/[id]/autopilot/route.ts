import type { Autopilot } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { getAutopilot, runAutopilot, saveAutopilot } from "@/lib/server/social/ideas";
import { getWorkspace } from "@/lib/server/social/store";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

async function exists(id: string) {
  return !!(await getWorkspace(id));
}

/** Autopilot der Kundenwelt */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await exists(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await getAutopilot(id));
});

/** Autopilot einstellen (nur übergebene Felder); nur das Team */
export const PATCH = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await exists(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    return Response.json(await saveAutopilot(id, (await request.json()) as Partial<Autopilot>));
  },
  { agent: false }
);

/** Jetzt ausführen: eine Woche recherchieren, erstellen und einplanen */
export const POST = withMarketing(async (actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await exists(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const result = await runAutopilot(id, actor.email);
  return Response.json({ result, autopilot: await getAutopilot(id) });
});
