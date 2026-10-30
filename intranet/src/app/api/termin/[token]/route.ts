import { bookInterview, InviteError, publicInvite } from "@/lib/server/interview";

// Öffentliche API der Terminwahl (sign.grid-agency.de/t/…). Zugang nur über
// den geheimen Link aus der Einladung; keine Anmeldung.

type Context = { params: Promise<{ token: string }> };

export const maxDuration = 30;

function fail(error: unknown) {
  if (error instanceof InviteError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Da ist etwas schiefgelaufen. Bitte versuch es erneut." }, { status: 500 });
}

export async function GET(_request: Request, { params }: Context) {
  const { token } = await params;
  try {
    return Response.json(await publicInvite(token), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as { start?: string };
  try {
    if (!body.start) return Response.json({ error: "Kein Termin gewählt" }, { status: 400 });
    return Response.json(await bookInterview(token, body.start));
  } catch (error) {
    return fail(error);
  }
}
