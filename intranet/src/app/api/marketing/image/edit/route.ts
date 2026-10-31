import { editImage, type EditOptions } from "@/lib/server/image/tools";
import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";

export const maxDuration = 60;

/** Bild bearbeiten (ohne externen Dienst): { path, format?: 4:5|9:16|1:1|16:9|1.91:1|original,
 * brightness?, contrast?, saturation? (-1…1), sharpen?, logo?: { workspace_id, variant?, position?, size? }, output? } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as EditOptions & { path?: string };
  if (!body.path) return Response.json({ error: "path fehlt" }, { status: 400 });
  try {
    const item = await editImage(body.path, body);
    return Response.json(withUrls([item], new URL(request.url).origin)[0], { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Bearbeiten fehlgeschlagen" }, { status: 400 });
  }
});
