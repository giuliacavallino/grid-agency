import type { ConnectProvider } from "@/lib/marketing";
import { startConnect } from "@/lib/server/social/connect";
import { resolveConnectLink } from "@/lib/server/social/store";

type Context = { params: Promise<{ token: string; provider: string }> };
// Kunden verbinden nur ihre Kanäle, nicht Canva
const PROVIDERS: ConnectProvider[] = ["meta", "linkedin", "tiktok"];

/** Kunde startet über seinen Link die Anmeldung bei Meta, LinkedIn oder TikTok */
export async function POST(request: Request, { params }: Context) {
  const { token, provider } = await params;
  if (!PROVIDERS.includes(provider as ConnectProvider)) return Response.json({ error: "Unbekannter Anbieter" }, { status: 404 });
  const workspace = await resolveConnectLink(token);
  if (!workspace) return Response.json({ error: "Der Link ist abgelaufen oder ungültig" }, { status: 404 });
  try {
    const url = await startConnect(provider as ConnectProvider, workspace.id, new URL(request.url).origin, "Kundenlink", `/verbinden/${token}`);
    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Verbinden fehlgeschlagen" }, { status: 400 });
  }
}
