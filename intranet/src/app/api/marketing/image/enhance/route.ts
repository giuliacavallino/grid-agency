import { enhance, type ImageFormat } from "@/lib/server/image/tools";
import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";

export const maxDuration = 120;

/** Rohbild automatisch verbessern (Claid.ai): { path, upscale?, format? } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { path?: string; upscale?: boolean; format?: ImageFormat };
  if (!body.path) return Response.json({ error: "path fehlt" }, { status: 400 });
  try {
    const item = await enhance(body.path, body);
    return Response.json(withUrls([item], new URL(request.url).origin)[0], { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verbessern fehlgeschlagen" }, { status: 400 });
  }
});
