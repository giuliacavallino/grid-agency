import { withMarketing } from "@/lib/server/social/auth";
import { aiCanvaDesign, CANVA_MISSING, type DesignFormat } from "@/lib/server/social/ai-design";
import { canvaAccount } from "@/lib/server/social/canva";
import { withUrls } from "@/lib/server/social/media";
import { getWorkspace } from "@/lib/server/social/store";
import { DEMO } from "@/lib/config";

// Claude, Grafik, Canva-Upload, Design und Export: dauert bis zu einer Minute
export const maxDuration = 300;

/** Mit KI in Canva gestalten: { workspace_id, caption, brief?, format: "feed" | "story" }
 * → { item: MediaItem, edit_url, headline, subline } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json().catch(() => ({}))) as { workspace_id?: string; caption?: unknown; brief?: unknown; format?: unknown };
  if (!body.workspace_id || !(await getWorkspace(body.workspace_id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  if (!DEMO && !(await canvaAccount())) return Response.json({ error: CANVA_MISSING }, { status: 409 });
  const caption = typeof body.caption === "string" ? body.caption.slice(0, 3000) : "";
  const brief = typeof body.brief === "string" ? body.brief.slice(0, 500) : "";
  if (!caption.trim() && !brief.trim()) return Response.json({ error: "Erst Text oder eine Idee eingeben" }, { status: 400 });
  const format: DesignFormat = body.format === "story" ? "story" : "feed";
  const result = await aiCanvaDesign(body.workspace_id, { caption, brief, format });
  return Response.json({ ...result, item: withUrls([result.item], new URL(request.url).origin)[0] }, { status: 201 });
});
