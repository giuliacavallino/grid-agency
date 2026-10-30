import { after } from "next/server";
import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";
import { archivePostMedia, cleanMedia, validatePost, type PostBody } from "@/lib/server/social/posts";
import { publishPost } from "@/lib/server/social/publish";
import { insertPost, listPosts } from "@/lib/server/social/store";

export const maxDuration = 300;

/** Posts einer Kundenwelt (?workspace=…&status=…) */
export const GET = withMarketing(async (_actor, request) => {
  const params = new URL(request.url).searchParams;
  const posts = await listPosts({ workspace_id: params.get("workspace") ?? undefined, status: params.get("status") ?? undefined });
  const origin = new URL(request.url).origin;
  return Response.json(posts.map((p) => ({ ...p, media: withUrls(p.media, origin) })));
});

/** Post anlegen: { workspace_id, caption, media, account_ids, scheduled_at? , publish_now? }.
 * Mit scheduled_at wird er geplant, mit publish_now sofort veröffentlicht. */
export const POST = withMarketing(async (actor, request) => {
  const body = (await request.json()) as PostBody;
  if (!body.workspace_id) return Response.json({ error: "workspace_id fehlt" }, { status: 400 });
  const invalid = await validatePost(body, body.workspace_id);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  if ((body.publish_now || body.scheduled_at) && !body.account_ids?.length) return Response.json({ error: "Mindestens einen Kanal wählen" }, { status: 400 });
  const post = await insertPost({
    workspace_id: body.workspace_id,
    caption: body.caption,
    media: cleanMedia(body.media),
    account_ids: body.account_ids,
    scheduled_at: body.scheduled_at ?? null,
    status: body.scheduled_at && !body.publish_now ? "scheduled" : "draft",
    created_by: actor.email,
  });
  const result = body.publish_now ? await publishPost(post.id, new URL(request.url).origin) : post;
  after(() => archivePostMedia(post.id).catch((error) => console.error("SharePoint-Ablage", error)));
  return Response.json({ ...result, media: withUrls(result.media) }, { status: 201 });
});
