import type { ConnectProvider } from "@/lib/marketing";
import { finishConnect, redeemState, withParam } from "@/lib/server/social/connect";

type Context = { params: Promise<{ provider: string }> };
const PROVIDERS: ConnectProvider[] = ["canva", "meta", "linkedin", "tiktok"];

/** Rücksprung vom Anbieter (ohne Intranet-Token, abgesichert über den State).
 * Zurück geht es in den Marketing Hub oder, bei Kunden-Links, auf deren Seite. */
export async function GET(request: Request, { params }: Context) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider as ConnectProvider)) return new Response("Unbekannter Anbieter", { status: 404 });
  const url = new URL(request.url);
  const base = process.env.INTRANET_URL ?? url.origin;
  const state = url.searchParams.get("state");
  const saved = state ? await redeemState(state, provider) : null;
  const target = saved?.return_path ?? (saved?.workspace_id ? `/marketing?welt=${saved.workspace_id}` : "/marketing");
  const back = (key: string, value: string) => Response.redirect(new URL(withParam(target, key, value), base), 302);

  const code = url.searchParams.get("code");
  if (!code) return back("error", url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "Anmeldung abgebrochen");
  try {
    await finishConnect(provider as ConnectProvider, code, saved, url.origin);
    return back("connected", provider);
  } catch (error) {
    console.error(error);
    return back("error", error instanceof Error ? error.message.slice(0, 300) : "Verbinden fehlgeschlagen");
  }
}
