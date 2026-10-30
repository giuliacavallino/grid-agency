import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";
import { getBrand } from "@/lib/server/social/store";
import { voiceover } from "@/lib/server/video/tools";

export const maxDuration = 120;

/** Voiceover (MP3): { text, voice_id?, workspace_id? }. Ohne voice_id gilt die Stimme aus der CI-Welt. */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { text?: string; voice_id?: string; workspace_id?: string };
  if (!body.text?.trim()) return Response.json({ error: "text fehlt" }, { status: 400 });
  const voice = body.voice_id || (body.workspace_id ? (await getBrand(body.workspace_id)).voice_id : undefined);
  const item = await voiceover(body.text, voice);
  return Response.json(withUrls([item], new URL(request.url).origin)[0], { status: 201 });
});
