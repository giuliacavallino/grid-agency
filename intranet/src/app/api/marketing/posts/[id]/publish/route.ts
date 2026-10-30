import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";
import { publishPost } from "@/lib/server/social/publish";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 300;

/** Jetzt veröffentlichen (auch erneuter Versuch nach Fehlern) */
export const POST = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  try {
    const post = await publishPost(id, new URL(request.url).origin);
    return Response.json({ ...post, media: withUrls(post.media) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 409 });
  }
});
