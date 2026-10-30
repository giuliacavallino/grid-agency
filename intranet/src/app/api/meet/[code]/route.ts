import { joinRoom, MeetError, roomView } from "@/lib/server/meet";
import { recordingEnabled } from "@/lib/server/meet-recording";

// Öffentliche API der Video-Calls (meet.grid-agency.de/…). Zugang nur über
// den Code aus dem Link; keine Anmeldung.

type Context = { params: Promise<{ code: string }> };

const headers = { "Cache-Control": "no-store" };

function fail(error: unknown) {
  if (error instanceof MeetError) return Response.json({ error: error.message }, { status: error.status, headers });
  console.error(error);
  return Response.json({ error: "Da ist etwas schiefgelaufen. Bitte versuch es erneut." }, { status: 500, headers });
}

export async function GET(_request: Request, { params }: Context) {
  const { code } = await params;
  try {
    // recording: Hinweis zur Aufzeichnung unter „Jetzt beitreten“
    return Response.json({ ...(await roomView(code)), recording: recordingEnabled() }, { headers });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  try {
    return Response.json(await joinRoom(code, String(body.name ?? "")), { headers });
  } catch (error) {
    return fail(error);
  }
}
