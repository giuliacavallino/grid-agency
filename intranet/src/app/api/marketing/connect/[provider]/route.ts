import type { ConnectProvider } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { startConnect } from "@/lib/server/social/connect";

type Context = { params: Promise<{ provider: string }> };
const PROVIDERS: ConnectProvider[] = ["canva", "meta", "linkedin", "tiktok"];

/** Login beim Anbieter starten; liefert die Adresse für den Browser */
export const POST = withMarketing(
  async (actor, request, { params }: Context) => {
    const { provider } = await params;
    if (!PROVIDERS.includes(provider as ConnectProvider)) return Response.json({ error: "Unbekannter Anbieter" }, { status: 404 });
    const { workspace_id } = (await request.json().catch(() => ({}))) as { workspace_id?: string };
    try {
      const url = await startConnect(provider as ConnectProvider, workspace_id ?? null, new URL(request.url).origin, actor.email);
      return Response.json({ url });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Verbinden fehlgeschlagen" }, { status: 400 });
    }
  },
  { agent: false }
);
