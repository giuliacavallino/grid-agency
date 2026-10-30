import { withUser } from "@/lib/server/auth";
import { DEMO } from "@/lib/config";
import { db } from "@/lib/server/db";
import { EasybillError, syncEasybill } from "@/lib/server/easybill";

export const maxDuration = 120;

/** Letzter Abgleich (Zeitpunkt und Zahlen) */
export const GET = withUser(async () => {
  return Response.json({ last: await db().getSetting("easybill_sync"), configured: DEMO || !!process.env.EASYBILL_API_KEY });
}, ["sales"]);

/** Abgleich auf Knopfdruck aus Kunden, Auftragsbuch oder Artikel */
export const POST = withUser(async () => {
  try {
    return Response.json(await syncEasybill());
  } catch (error) {
    if (error instanceof EasybillError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}, ["sales"]);
