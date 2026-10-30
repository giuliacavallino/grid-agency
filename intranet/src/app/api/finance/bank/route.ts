import { withUser } from "@/lib/server/auth";
import { syncBank } from "@/lib/server/bank";
import { db } from "@/lib/server/db";
import { bankConfigured, BankError } from "@/lib/server/enable-banking";

export const maxDuration = 120;

/** Stand der Bankanbindung: eingerichtet? letzter Abgleich? */
export const GET = withUser(async () => {
  return Response.json({ configured: bankConfigured(), last: await db().getSetting("bank_sync") });
}, ["admin"]);

/** Abgleich auf Knopfdruck, mit IP und Browser der Person (zählt nicht
 * gegen die 4 automatischen Abrufe am Tag, die der Cron braucht). */
export const POST = withUser(async (_user, request) => {
  if (!bankConfigured()) return Response.json({ error: "Enable Banking ist nicht eingerichtet" }, { status: 503 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const userAgent = request.headers.get("user-agent");
  try {
    return Response.json(await syncBank(ip && userAgent ? { ip, userAgent } : undefined));
  } catch (error) {
    if (error instanceof BankError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}, ["admin"]);
