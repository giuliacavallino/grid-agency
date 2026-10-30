import { MeetError, roomId } from "@/lib/server/meet";
import { startRecording } from "@/lib/server/meet-recording";

// Startet die Tonaufnahme, sobald jemand im Call ist. Alle Beitretenden
// haben mit „Jetzt beitreten“ zugestimmt (Hinweis unter dem Button).

type Context = { params: Promise<{ code: string }> };

export const maxDuration = 30;

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { serverCallId?: string };
  const serverCallId = String(body.serverCallId ?? "").slice(0, 500);
  if (!serverCallId) return Response.json({ error: "serverCallId fehlt" }, { status: 400 });
  try {
    return Response.json(await startRecording(await roomId(code), serverCallId));
  } catch (error) {
    if (error instanceof MeetError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ recording: false }, { status: 500 });
  }
}
