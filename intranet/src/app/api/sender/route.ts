import { withUser } from "@/lib/server/auth";
import { disconnect, senderInfo } from "@/lib/server/sender";

/** Absender-Konto für Kunden-Updates (Admin → Absender & Updates) */
export const GET = withUser(async () => {
  const sender = await senderInfo();
  const ready = { secret: !!process.env.MS_CLIENT_SECRET, vault: !!process.env.VAULT_KEY, claude: !!process.env.ANTHROPIC_API_KEY };
  return Response.json({ sender, ready });
}, ["admin"]);

export const DELETE = withUser(async () => {
  await disconnect();
  return new Response(null, { status: 204 });
}, ["admin"]);
