import { withUser } from "@/lib/server/auth";
import { decrypt, getVisible, log } from "@/lib/server/vault";

type Context = { params: Promise<{ id: string }> };

/** Entschlüsselt ein Passwort zum Anzeigen oder Kopieren und protokolliert das. */
export const POST = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const item = await getVisible(user, id);
  if (!item) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const { purpose } = (await request.json().catch(() => ({}))) as { purpose?: string };
  await log(user, item, purpose === "copy" ? "kopiert" : "angezeigt");
  return Response.json({ password: item.secret ? decrypt(item.secret) : "" }, { headers: { "Cache-Control": "no-store" } });
});
