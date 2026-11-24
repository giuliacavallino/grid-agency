import { MeetError, recordingRoom } from "@/lib/server/meet";
import { claimRecorder, RecordingError } from "@/lib/server/meet-recording";

// Aufnahme des Calls im Browser: Jeder Browser im Call bewirbt sich hier;
// genau einer bekommt die Zusage und lädt dann den Ton hoch. Alle
// Beitretenden haben mit „Jetzt beitreten“ zugestimmt (Hinweis unter dem Button).

type Context = { params: Promise<{ code: string }> };

export const maxDuration = 30;

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { serverCallId?: string; segment?: string };
  const serverCallId = String(body.serverCallId ?? "").slice(0, 500);
  if (!serverCallId) return Response.json({ error: "serverCallId fehlt" }, { status: 400 });
  try {
    const room = await recordingRoom(code);
    // Beim Anlegen „Aufzeichnen“ abgewählt: keine Aufnahme
    if (!room.record) return Response.json({ recording: false });
    return Response.json(await claimRecorder(room.id, serverCallId, String(body.segment ?? "")));
  } catch (error) {
    if (error instanceof MeetError || error instanceof RecordingError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ recording: false }, { status: 500 });
  }
}
