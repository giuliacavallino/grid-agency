import { withUser } from "@/lib/server/auth";
import { envelopePdfUrl, markEnvelopeSent, revokeEnvelope, SignError } from "@/lib/server/sign";

type Context = { params: Promise<{ id: string }> };

/** Versand vermerken, Mappe zurückziehen oder Link auf das unterschriebene PDF */
export const POST = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: string; by?: string; to?: string };
  try {
    switch (body.action) {
      case "versendet":
        await markEnvelopeSent(id, String(body.by ?? user.email).slice(0, 200), String(body.to ?? "").slice(0, 300));
        return Response.json({ ok: true });
      case "widerrufen":
        await revokeEnvelope(id, user.name);
        return Response.json({ ok: true });
      case "pdf":
        return Response.json({ url: await envelopePdfUrl(id) });
      default:
        return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof SignError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
