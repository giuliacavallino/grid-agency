import { withMarketing } from "@/lib/server/social/auth";
import { createConnectLink, getWorkspace } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

/** Verbindungslink für den Kunden (14 Tage gültig). Der Kunde meldet sich
 * darüber selbst bei Instagram/Facebook, LinkedIn und TikTok an. */
export const POST = withMarketing(async (actor, request, { params }: Context) => {
  const { id } = await params;
  const workspace = await getWorkspace(id);
  if (!workspace) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  if (workspace.kind === "agency") return Response.json({ error: "Für GRID selbst direkt im Hub verbinden" }, { status: 400 });
  const { token, expires_at } = await createConnectLink(id, actor.email);
  const base = process.env.INTRANET_URL ?? new URL(request.url).origin;
  return Response.json({ url: `${base}/verbinden/${token}`, expires_at }, { headers: { "Cache-Control": "no-store" } });
});
