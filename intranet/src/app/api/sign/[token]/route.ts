import { decline, publicView, signEnvelope, SignError, type Client, type SignInput } from "@/lib/server/sign";

// Öffentliche API der Unterschriftsseite (sign.grid-agency.de). Zugang nur
// über den geheimen Link; keine Anmeldung.

type Context = { params: Promise<{ token: string }> };

export const maxDuration = 60;

const client = (request: Request): Client => ({
  ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unbekannt",
  ua: (request.headers.get("user-agent") ?? "").slice(0, 300),
});

function fail(error: unknown) {
  if (error instanceof SignError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Da ist etwas schiefgelaufen. Bitte versuchen Sie es erneut." }, { status: 500 });
}

export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  try {
    return Response.json(await publicView(token, client(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, { params }: Context) {
  const { token } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string } & SignInput;
  try {
    if (body.action === "ablehnen") {
      await decline(token, String(body.reason ?? ""), client(request));
      return Response.json({ ok: true });
    }
    if (body.action === "unterschreiben") {
      return Response.json(await signEnvelope(token, body, client(request)));
    }
    return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
