import { withMarketing } from "@/lib/server/social/auth";
import { CANVA_MISSING, refreshCanvaDesign } from "@/lib/server/social/ai-design";
import { canvaAccount } from "@/lib/server/social/canva";
import { withUrls } from "@/lib/server/social/media";
import { DEMO } from "@/lib/config";

export const maxDuration = 300;

/** Design nach Änderungen in Canva neu exportieren: { design_id } → MediaItem (erste Seite als PNG) */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json().catch(() => ({}))) as { design_id?: unknown };
  const id = typeof body.design_id === "string" ? body.design_id : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return Response.json({ error: "design_id fehlt" }, { status: 400 });
  if (!DEMO && !(await canvaAccount())) return Response.json({ error: CANVA_MISSING }, { status: 409 });
  return Response.json(withUrls([await refreshCanvaDesign(id)], new URL(request.url).origin)[0]);
});
