import { withMarketing } from "@/lib/server/social/auth";
import { draftReply, getComment, replyToComment, setCommentStatus } from "@/lib/server/social/community";

type Context = { params: Promise<{ id: string }> };

/** Antworten: { text } schreibt die Antwort; { draft: true } liefert nur einen
 * Vorschlag von Claude; { status: skipped|needs_human|new, reason? } ändert den Status */
export const POST = withMarketing(async (actor, request, { params }: Context) => {
  const { id } = await params;
  const comment = await getComment(id);
  if (!comment) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { text?: string; draft?: boolean; status?: "skipped" | "needs_human" | "new"; reason?: string };
  try {
    if (body.draft) return Response.json(await draftReply(comment));
    if (body.status) {
      if (!["skipped", "needs_human", "new"].includes(body.status)) return Response.json({ error: "Status ungültig" }, { status: 400 });
      await setCommentStatus(id, body.status, body.reason);
      return Response.json(await getComment(id));
    }
    return Response.json(await replyToComment(id, body.text ?? "", actor.email));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});
