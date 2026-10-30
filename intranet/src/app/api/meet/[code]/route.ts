import { joinRoom, MeetError, roomView } from "@/lib/server/meet";

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
    return Response.json(await roomView(code), { headers });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(_request: Request, { params }: Context) {
  const { code } = await params;
  try {
    return Response.json(await joinRoom(code), { headers });
  } catch (error) {
    return fail(error);
  }
}
