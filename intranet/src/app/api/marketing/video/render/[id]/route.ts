import { withMarketing } from "@/lib/server/social/auth";
import { withUrls } from "@/lib/server/social/media";
import { renderStatus, storeRender } from "@/lib/server/video/tools";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 300;

/** Status eines Renderings. Ist es fertig, mit ?store=1 ins Intranet holen
 * (→ media, direkt für einen Post verwendbar). */
export const GET = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  const render = await renderStatus(id);
  if (new URL(request.url).searchParams.get("store") !== "1") return Response.json(render);
  const item = await storeRender(render);
  return Response.json({ ...render, media: item ? withUrls([item], new URL(request.url).origin)[0] : null });
});
