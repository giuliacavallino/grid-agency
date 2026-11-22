import { withMarketing } from "@/lib/server/social/auth";
import { getWorkspace } from "@/lib/server/social/store";
import { getGoogleSettings } from "@/lib/server/google";
import { actOnAutomation, listAutomations, MakeError, type AutomationAction } from "@/lib/server/make";

type Context = { params: Promise<{ id: string }> };

/** Make-Szenarien der Akte mit Status und letzten Läufen */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const settings = await getGoogleSettings(id);
  return Response.json(await listAutomations(settings.make_scenarios), { headers: { "Cache-Control": "no-store" } });
});

/** { scenario, action: "run" | "start" | "stop" } – nur zugeordnete Szenarien */
export const POST = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { scenario?: number; action?: string };
    const scenario = Number(body.scenario);
    const action = body.action as AutomationAction;
    if (!["run", "start", "stop"].includes(action)) return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
    const settings = await getGoogleSettings(id);
    if (!settings.make_scenarios.includes(scenario)) return Response.json({ error: "Szenario gehört nicht zu dieser Akte" }, { status: 403 });
    try {
      await actOnAutomation(scenario, action);
    } catch (error) {
      if (error instanceof MakeError) return Response.json({ error: error.message }, { status: 502 });
      throw error;
    }
    return Response.json(await listAutomations(settings.make_scenarios));
  },
  { agent: false }
);
