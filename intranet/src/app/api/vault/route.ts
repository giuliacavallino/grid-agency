import { withUser } from "@/lib/server/auth";
import { createItem, listItems, type VaultInput } from "@/lib/server/vault";

/** Alle Zugänge, die der Nutzer sehen darf (ohne Passwörter). */
export const GET = withUser(async (user) => Response.json(await listItems(user)));

export const POST = withUser(async (user, request) => {
  const input = (await request.json()) as VaultInput;
  if (!input.title?.trim()) return Response.json({ error: "Titel fehlt" }, { status: 400 });
  if (input.internal && !user.admin) return Response.json({ error: "Nur für die Geschäftsführung" }, { status: 403 });
  return Response.json(await createItem(user, input), { status: 201 });
});
