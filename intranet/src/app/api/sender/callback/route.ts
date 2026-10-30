import { finishConnect } from "@/lib/server/sender";

/** Rücksprung von Microsoft nach der Anmeldung des Absender-Kontos. Ohne
 * Intranet-Token; abgesichert über den State aus /api/sender/connect. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL("/admin/absender", process.env.INTRANET_URL ?? url.origin);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    back.searchParams.set("error", url.searchParams.get("error_description")?.split("\r\n")[0] ?? "Anmeldung abgebrochen");
    return Response.redirect(back, 302);
  }
  try {
    await finishConnect(code, state, url.origin);
    back.searchParams.set("connected", "1");
  } catch (error) {
    back.searchParams.set("error", error instanceof Error ? error.message : "Verbinden fehlgeschlagen");
  }
  return Response.redirect(back, 302);
}
