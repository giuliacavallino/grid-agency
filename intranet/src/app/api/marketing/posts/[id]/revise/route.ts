import { withMarketing } from "@/lib/server/social/auth";
import { revisePost } from "@/lib/server/social/day-autopilot";
import { withUrls } from "@/lib/server/social/media";

export const maxDuration = 300;

type Context = { params: Promise<{ id: string }> };

/** Änderung wünschen: { feedback }. Claude überarbeitet Caption und Grafiken. */
export const POST = withMarketing(async (actor, request, { params }: Context) => {
  const body = (await request.json()) as { feedback?: string };
  try {
    const saved = await revisePost((await params).id, String(body.feedback ?? ""), actor.email);
    return Response.json({ ...saved, media: withUrls(saved.media, new URL(request.url).origin) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});
