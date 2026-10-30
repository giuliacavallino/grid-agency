import { CaptchaError } from "@/lib/server/altcha";
import { book, bookingView, FlowError, type BookingInput, type MeetingKind } from "@/lib/server/lead-flow";

// Öffentlich: Terminbuchung der Website (Erstgespräch, mit Einladungslink
// auch Kick-off). Die Website ruft das serverseitig auf; Captcha Pflicht.

export const maxDuration = 30;

const kindOf = (value: string | null): MeetingKind => (value === "kickoff" ? "kickoff" : "erstgespraech");

function fail(error: unknown) {
  if (error instanceof FlowError || error instanceof CaptchaError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Da ist etwas schiefgelaufen. Bitte versuch es erneut." }, { status: 500 });
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  try {
    return Response.json(await bookingView(kindOf(search.get("art")), search.get("l")), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<keyof BookingInput, string>>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  try {
    return Response.json(
      await book({
        kind: kindOf(text(body.kind)),
        token: text(body.token) || null,
        start: text(body.start),
        name: text(body.name),
        email: text(body.email),
        company: text(body.company),
        phone: text(body.phone),
        message: text(body.message),
        altcha: text(body.altcha),
      })
    );
  } catch (error) {
    return fail(error);
  }
}
