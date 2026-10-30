import { withMarketing } from "@/lib/server/social/auth";
import { exportDesign, type ExportFormat } from "@/lib/server/social/canva";
import { withUrls } from "@/lib/server/social/media";

export const maxDuration = 300;
const FORMATS: ExportFormat[] = ["png", "jpg", "mp4", "pdf"];

/** Design exportieren und im Intranet ablegen: { design_id, format?, pages?, vertical? }
 * → Medien, die direkt in einen Post können */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { design_id?: string; format?: ExportFormat; pages?: number[]; vertical?: boolean };
  if (!body.design_id) return Response.json({ error: "design_id fehlt" }, { status: 400 });
  const format = FORMATS.includes(body.format as ExportFormat) ? (body.format as ExportFormat) : "png";
  const media = await exportDesign(body.design_id, format, { pages: body.pages, vertical: body.vertical });
  return Response.json({ media: withUrls(media, new URL(request.url).origin) });
});
