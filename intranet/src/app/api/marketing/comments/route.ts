import type { CommentStatus } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { listCommentRows } from "@/lib/server/social/community";

/** LinkedIn-Kommentare einer Kundenwelt (?workspace=…&status=new|replied|skipped|needs_human|failed) */
export const GET = withMarketing(async (_actor, request) => {
  const params = new URL(request.url).searchParams;
  const comments = await listCommentRows({
    workspace_id: params.get("workspace") ?? undefined,
    status: (params.get("status") as CommentStatus | null) ?? undefined,
    limit: Math.min(Math.max(Number(params.get("limit")) || 200, 1), 500),
  });
  return Response.json(comments.filter((c) => c.status !== "own"));
});
