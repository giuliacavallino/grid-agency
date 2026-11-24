import { after } from "next/server";
import { MeetError, recordingRoom } from "@/lib/server/meet";
import { processRecording, RecordingError, releaseRecorder } from "@/lib/server/meet-recording";

// Aufnehmender Browser verlässt den Call. end=true (letzte Person im Call):
// Aufnahme abschließen und auswerten; sonst übernimmt ein anderer Browser.
// Kommt auch per sendBeacon (text/plain).

type Context = { params: Promise<{ code: string; id: string }> };

export const maxDuration = 300;

export async function POST(request: Request, { params }: Context) {
  const { code, id } = await params;
  const body = (JSON.parse((await request.text().catch(() => "")) || "{}") ?? {}) as { segment?: string; end?: boolean };
  try {
    const room = await recordingRoom(code);
    const ready = await releaseRecorder(id, room.id, String(body.segment ?? ""), body.end === true);
    if (ready) after(() => processRecording(ready));
    return Response.json({ ok: true, processing: !!ready });
  } catch (error) {
    if (error instanceof MeetError || error instanceof RecordingError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ error: "Hat nicht geklappt" }, { status: 500 });
  }
}
