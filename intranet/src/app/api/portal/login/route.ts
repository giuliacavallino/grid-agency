import { PortalError, requestLogin } from "@/lib/server/portal";

/** Anmeldelink anfordern: { email }. Antwortet immer gleich, damit niemand
 * herausfinden kann, welche Adressen freigeschaltet sind. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string };
  try {
    const result = await requestLogin(String(body.email ?? ""), new URL(request.url).origin);
    return Response.json({ ok: true, ...("demo_url" in result ? { demo_url: result.demo_url } : {}) });
  } catch (error) {
    if (error instanceof PortalError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Portal-Anmeldung:", error);
    return Response.json({ error: "Der Link konnte gerade nicht verschickt werden. Bitte später erneut versuchen." }, { status: 500 });
  }
}
