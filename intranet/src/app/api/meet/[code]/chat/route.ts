import { MeetError } from "@/lib/server/meet";
import { listMessages, postMessage } from "@/lib/server/meet-chat";

// Chat im Video-Call; Zugang wie zum Call nur über den Code aus dem Link.

type Context = { params: Promise<{ code: string }> };

const headers = { "Cache-Control": "no-store" };

function fail(error: unknown) {
  if (error instanceof MeetError) return Response.json({ error: error.message }, { status: error.status, headers });
  console.error(error);
  return Response.json({ error: "Nachricht konnte nicht geladen bzw. gesendet werden." }, { status: 500, headers });
}

/** Nachrichten des laufenden Termins, ?after= nur neuere */
export async function GET(request: Request, { params }: Context) {
  const { code } = await params;
  try {
    return Response.json(await listMessages(code, new URL(request.url).searchParams.get("after")), { headers });
  } catch (error) {
    return fail(error);
  }
}

/** { name, text } senden */
export async function POST(request: Request, { params }: Context) {
  const { code } = await params;
  const body = (await request.json().catch(() => ({}))) as { name?: string; text?: string };
  try {
    return Response.json(await postMessage(code, String(body.name ?? ""), String(body.text ?? "")), { status: 201, headers });
  } catch (error) {
    return fail(error);
  }
}
