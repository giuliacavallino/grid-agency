import { withMarketing } from "@/lib/server/social/auth";
import { getDayAutopilot, saveDayAutopilot, type DayAutopilot } from "@/lib/server/social/day-autopilot";
import { getWorkspace } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

const view = ({ done, failed, ...rest }: DayAutopilot) => ({ ...rest, done_count: done.length, failed_count: Object.keys(failed ?? {}).length });

/** Einstellungen des Tage-Autopiloten */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(view(await getDayAutopilot(id)));
});

/** { enabled?, lead_days?, post?, carousel?, story? } */
export const PUT = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const body = (await request.json()) as Partial<DayAutopilot>;
    return Response.json(view(await saveDayAutopilot(id, { enabled: body.enabled, lead_days: body.lead_days, post: body.post, carousel: body.carousel, story: body.story })));
  },
  { agent: false }
);
