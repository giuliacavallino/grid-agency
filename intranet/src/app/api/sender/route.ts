import { withUser } from "@/lib/server/auth";
import { disconnect, senderInfo } from "@/lib/server/sender";
import { updatesBlocked } from "@/lib/server/updates";
import { vaultStatus } from "@/lib/server/vault";

/** Absender-Konto für Kunden-Updates (Admin → Absender & Updates) */
export const GET = withUser(async () => {
  const sender = await senderInfo();
  // Nur ob etwas gesetzt ist, nie Werte
  const ready = { secret: !!process.env.MS_CLIENT_SECRET, vault: vaultStatus(), claude: !!process.env.ANTHROPIC_API_KEY };
  return Response.json({ sender, ready, paused: await updatesBlocked() });
}, ["admin"]);

export const DELETE = withUser(async () => {
  await disconnect();
  return new Response(null, { status: 204 });
}, ["admin"]);
