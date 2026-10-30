import { withMarketing } from "@/lib/server/social/auth";
import { startRender, type RenderInput } from "@/lib/server/video/tools";

/** Video rendern: { template_id, modifications } oder { source } (RenderScript, z. B. zum Schneiden).
 * Liefert die Render-ID; Status und fertiges Video über GET /api/marketing/video/render/{id}. */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as RenderInput;
  try {
    return Response.json(await startRender(body), { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Rendern fehlgeschlagen" }, { status: 400 });
  }
});
