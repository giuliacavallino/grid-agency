import type { PostIdea } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { getIdea, updateIdea } from "@/lib/server/social/ideas";

type Context = { params: Promise<{ id: string }> };

/** Vorschlag ändern oder verwerfen: { status?: "new" | "dismissed", title?, caption?, hashtags? } */
export const PATCH = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  const idea = await getIdea(id);
  if (!idea) return Response.json({ error: "Vorschlag nicht gefunden" }, { status: 404 });
  const body = (await request.json()) as Partial<PostIdea>;
  const patch: Parameters<typeof updateIdea>[1] = {};
  if (body.status === "new" || body.status === "dismissed") patch.status = body.status;
  if (typeof body.title === "string") patch.title = body.title.slice(0, 160);
  if (typeof body.caption === "string") patch.caption = body.caption.slice(0, 3000);
  if (Array.isArray(body.hashtags)) patch.hashtags = body.hashtags.map(String).slice(0, 12);
  return Response.json(await updateIdea(id, patch));
});
