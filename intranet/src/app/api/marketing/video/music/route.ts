import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";
import { music } from "@/lib/server/video/tools";

export const maxDuration = 300;

/** Musik (MP3) aus einer Beschreibung: { prompt, seconds? } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { prompt?: string; seconds?: number };
  if (!body.prompt?.trim()) return Response.json({ error: "prompt fehlt" }, { status: 400 });
  const item = await music(body.prompt, body.seconds);
  return Response.json(withUrls([item], new URL(request.url).origin)[0], { status: 201 });
});
