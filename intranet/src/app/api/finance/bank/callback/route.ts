import { connect, syncBank } from "@/lib/server/bank";
import { db } from "@/lib/server/db";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 120;

type AuthState = { state: string; by: string; at: string };

/** Rückleitung von der Bank nach Login und photoTAN. Ohne Microsoft-Token
 * (Weiterleitung der Bank); berechtigt ist nur, wer den state aus
 * „Konto verbinden“ mitbringt: einmalig und 30 Minuten gültig. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (params: Record<string, string>) =>
    Response.redirect(`${url.origin}/finance/bank?${new URLSearchParams(params)}`, 303);

  const store = db();
  const pending = await store.getSetting<AuthState>("bank_auth");
  const state = url.searchParams.get("state") ?? "";
  if (!pending?.state || !state || !safeEqual(state, pending.state) || Date.now() - new Date(pending.at).getTime() > 30 * 60_000) {
    return back({ fehler: "Die Freigabe ist abgelaufen. Bitte noch einmal verbinden." });
  }
  await store.setSetting("bank_auth", {});

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (error || !code) {
    return back({ fehler: url.searchParams.get("error_description") || "Die Bank hat die Freigabe abgebrochen." });
  }

  try {
    const accounts = await connect(code);
    await syncBank().catch((e) => console.error(e));
    return back({ verbunden: String(accounts.length) });
  } catch (e) {
    console.error(e);
    return back({ fehler: e instanceof Error ? e.message : "Verbinden fehlgeschlagen" });
  }
}
