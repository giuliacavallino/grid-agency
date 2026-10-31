import { photoroom, type ImageFormat } from "@/lib/server/image/tools";
import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";

export const maxDuration = 120;

/** Hintergrund entfernen oder ersetzen (Photoroom): { path, background_color?, background_prompt?, format? } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { path?: string; background_color?: string; background_prompt?: string; format?: ImageFormat };
  if (!body.path) return Response.json({ error: "path fehlt" }, { status: 400 });
  try {
    const item = await photoroom(body.path, body);
    return Response.json(withUrls([item], new URL(request.url).origin)[0], { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Freistellen fehlgeschlagen" }, { status: 400 });
  }
});
