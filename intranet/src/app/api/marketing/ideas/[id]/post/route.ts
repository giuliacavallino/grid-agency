import { withMarketing } from "@/lib/server/social/auth";
import { ideaToPost, type IdeaToPost } from "@/lib/server/social/ideas";
import { withUrls } from "@/lib/server/social/media";

export const maxDuration = 120;

type Context = { params: Promise<{ id: string }> };

/** Aus einem Vorschlag einen Post machen: { schedule?: "none" | "next" | ISO, graphic?: boolean, mode?: "auto" | "review" }.
 * Mit Termin und verbundenem Kanal wird er eingeplant, sonst Entwurf. */
export const POST = withMarketing(async (actor, request, { params }: Context) => {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Omit<IdeaToPost, "by">;
  if (body.schedule && !["none", "next"].includes(body.schedule) && Number.isNaN(Date.parse(body.schedule))) {
    return Response.json({ error: "schedule ist kein Datum" }, { status: 400 });
  }
  const post = await ideaToPost(id, { ...body, by: actor.email });
  return Response.json({ ...post, media: withUrls(post.media, new URL(request.url).origin) }, { status: 201 });
});
