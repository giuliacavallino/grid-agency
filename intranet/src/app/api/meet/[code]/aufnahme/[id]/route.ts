import { MeetError, recordingRoom } from "@/lib/server/meet";
import { RecordingError, storePart } from "@/lib/server/meet-recording";

// Ein Teil der Aufnahme (rund 30 Sekunden Ton) vom aufnehmenden Browser.
// ?segment=<Browser-Sitzung>&index=<laufende Nummer>, Body: Audio (webm/opus)

type Context = { params: Promise<{ code: string; id: string }> };

export const maxDuration = 30;

export async function POST(request: Request, { params }: Context) {
  const { code, id } = await params;
  const url = new URL(request.url);
  try {
    const room = await recordingRoom(code);
    const audio = Buffer.from(await request.arrayBuffer());
    await storePart(id, room.id, url.searchParams.get("segment") ?? "", Number(url.searchParams.get("index")), audio, request.headers.get("content-type") ?? "");
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof MeetError || error instanceof RecordingError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ error: "Teil nicht gespeichert" }, { status: 500 });
  }
}
