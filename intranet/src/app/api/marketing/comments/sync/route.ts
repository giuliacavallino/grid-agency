import { withMarketing } from "@/lib/server/social/auth";
import { autoReply, syncComments } from "@/lib/server/social/community";

export const maxDuration = 300;

/** Kommentare jetzt abrufen { workspace_id? } und, wo der Autopilot an ist, beantworten */
export const POST = withMarketing(async (_actor, request) => {
  const { workspace_id } = (await request.json().catch(() => ({}))) as { workspace_id?: string };
  const synced = await syncComments(workspace_id);
  const replied = await autoReply();
  return Response.json({ synced, replied });
});
