import { withUser } from "@/lib/server/auth";
import { deleteItem, getVisible, updateItem, VAULT_NOT_READY, vaultStatus, type VaultInput } from "@/lib/server/vault";

type Context = { params: Promise<{ id: string }> };

export const PATCH = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const item = await getVisible(user, id);
  if (!item) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const input = (await request.json()) as VaultInput;
  if (input.internal && !user.admin) return Response.json({ error: "Nur für die Geschäftsführung" }, { status: 403 });
  if ("title" in input && !input.title?.trim()) return Response.json({ error: "Titel fehlt" }, { status: 400 });
  if (input.password && vaultStatus() !== "ok") return Response.json({ error: VAULT_NOT_READY }, { status: 503 });
  return Response.json(await updateItem(user, item, input));
});

export const DELETE = withUser(async (user, _request, { params }: Context) => {
  const { id } = await params;
  const item = await getVisible(user, id);
  if (!item) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  await deleteItem(user, item);
  return new Response(null, { status: 204 });
});
