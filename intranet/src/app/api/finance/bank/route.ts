import { withUser } from "@/lib/server/auth";
import { easybillConfigured, syncBank } from "@/lib/server/bank";
import { db } from "@/lib/server/db";
import { bankConfigured, BankError } from "@/lib/server/enable-banking";

export const maxDuration = 120;

/** Stand der Bankanbindung: eingerichtet? letzter Abgleich? */
export const GET = withUser(async () => {
  return Response.json({
    configured: bankConfigured(),
    easybill: easybillConfigured(),
    last: await db().getSetting("bank_sync"),
  });
}, ["finance"]);

/** Abgleich auf Knopfdruck. Banken erlauben ohne TAN nur wenige Abrufe am
 * Tag (PSD2: 4 je Konto), daher kein Automatismus beim Öffnen der Seite. */
export const POST = withUser(async () => {
  if (!bankConfigured()) return Response.json({ error: "Enable Banking ist nicht eingerichtet" }, { status: 503 });
  try {
    return Response.json(await syncBank());
  } catch (error) {
    if (error instanceof BankError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}, ["finance"]);
