import { after } from "next/server";
import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";
import { archivePostMedia, cleanMedia, validatePost, type PostBody } from "@/lib/server/social/posts";
import { deletePost, getPost, updatePost } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

export const GET = withMarketing(async (_actor, request, { params }: Context) => {
  const post = await getPost((await params).id);
  if (!post) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  return Response.json({ ...post, media: withUrls(post.media, new URL(request.url).origin) });
});

/** Entwurf oder geplanten Post ändern; status "scheduled" plant ihn, "draft" nimmt ihn aus dem Plan */
export const PATCH = withMarketing(async (_actor, request, { params }: Context) => {
  const post = await getPost((await params).id);
  if (!post) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  if (!["draft", "scheduled", "failed"].includes(post.status)) return Response.json({ error: "Veröffentlichte Posts lassen sich nicht mehr ändern" }, { status: 409 });
  const body = (await request.json()) as PostBody;
  const invalid = await validatePost(body, post.workspace_id);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  const patch: Parameters<typeof updatePost>[1] = {};
  if (body.caption !== undefined) patch.caption = body.caption;
  if (body.media !== undefined) patch.media = cleanMedia(body.media);
  if (body.account_ids !== undefined) patch.account_ids = body.account_ids;
  if (body.scheduled_at !== undefined) patch.scheduled_at = body.scheduled_at;
  if (body.status === "draft" || body.status === "scheduled") patch.status = body.status;
  const next = { ...post, ...patch };
  if (next.status === "scheduled" && (!next.scheduled_at || !next.account_ids.length)) {
    return Response.json({ error: "Zum Planen braucht es Zeitpunkt und mindestens einen Kanal" }, { status: 400 });
  }
  const saved = await updatePost(post.id, patch);
  if (body.media !== undefined) after(() => archivePostMedia(post.id).catch((error) => console.error("SharePoint-Ablage", error)));
  return Response.json({ ...saved, media: withUrls(saved.media, new URL(request.url).origin) });
});

export const DELETE = withMarketing(async (_actor, _request, { params }: Context) => {
  const post = await getPost((await params).id);
  if (!post) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  if (post.status === "publishing") return Response.json({ error: "Wird gerade veröffentlicht" }, { status: 409 });
  // Löscht nur den Eintrag im Hub, nicht den Post auf der Plattform
  await deletePost(post.id);
  return new Response(null, { status: 204 });
});
