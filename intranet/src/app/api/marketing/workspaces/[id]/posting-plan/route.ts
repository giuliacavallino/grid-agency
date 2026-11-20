import { withMarketing } from "@/lib/server/social/auth";
import { getPostingPlan, savePostingPlan } from "@/lib/server/social/posting-plan";
import { getWorkspace, updateWorkspaceSettings } from "@/lib/server/social/store";
import type { PostingPlan } from "@/lib/posting-plan";

type Context = { params: Promise<{ id: string }> };

/** Postingplan der Kundenwelt */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await getPostingPlan(id));
});

/** Postingplan speichern: { rules, owner, start, platforms, notes, source, planning? } */
export const PUT = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const { planning, ...body } = (await request.json()) as Partial<PostingPlan> & { planning?: boolean };
    // Planung für die Akte an/aus (z. B. reine Google-Betreuung ohne Social Media)
    if (typeof planning === "boolean") await updateWorkspaceSettings(id, { planning });
    return Response.json(await savePostingPlan(id, body));
  },
  { agent: false }
);
