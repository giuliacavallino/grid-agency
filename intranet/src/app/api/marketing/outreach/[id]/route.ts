import { INVITATION_LIMIT, type Outreach } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { deleteOutreach, updateOutreach } from "@/lib/server/social/community";

type Context = { params: Promise<{ id: string }> };

/** Text ändern oder Status setzen: { text?, status?: draft|sent|discarded } */
export const PATCH = withMarketing(async (actor, request, { params }: Context) => {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { text?: string; status?: Outreach["status"] };
  if (body.status && !["draft", "sent", "discarded"].includes(body.status)) return Response.json({ error: "Status ungültig" }, { status: 400 });
  if ((body.text?.length ?? 0) > 8000) return Response.json({ error: "Text zu lang" }, { status: 400 });
  try {
    const item = await updateOutreach(id, body, actor.email);
    if (item.kind === "invitation" && item.text.length > INVITATION_LIMIT) return Response.json({ ...item, warning: `Notiz länger als ${INVITATION_LIMIT} Zeichen` });
    return Response.json(item);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});

export const DELETE = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  await deleteOutreach(id);
  return new Response(null, { status: 204 });
});
