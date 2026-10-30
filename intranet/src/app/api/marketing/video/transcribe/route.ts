import { withMarketing } from "@/lib/server/social/auth";
import { transcribe, type SubtitleFormat } from "@/lib/server/video/tools";

export const maxDuration = 300;
const FORMATS: SubtitleFormat[] = ["srt", "vtt", "text"];

/** Transkript/Untertitel eines abgelegten Videos oder Audios: { path, format?: srt|vtt|text, language? } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { path?: string; format?: SubtitleFormat; language?: string };
  if (!body.path) return Response.json({ error: "path fehlt (aus /api/marketing/media oder einem Export)" }, { status: 400 });
  const format = FORMATS.includes(body.format as SubtitleFormat) ? (body.format as SubtitleFormat) : "srt";
  return Response.json(await transcribe(body.path, format, body.language?.slice(0, 5) || "de"));
});
