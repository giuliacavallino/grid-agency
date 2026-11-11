import { db } from "@/lib/server/db";
import { syncSentOffers } from "@/lib/server/offers";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 300;

/** Stündlich (vercel.json): gesendete Mails der Sales-Postfächer prüfen,
 * verschickte Angebote als Lead übernehmen, Nachfass-Termine setzen. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Nicht erlaubt", { status: 401 });
  if (!process.env.MS_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ skipped: "MS_CLIENT_SECRET / ANTHROPIC_API_KEY fehlen" });
  }
  // Etwas Überlappung, falls ein Lauf ausfällt; bekannte Mails werden übersprungen
  const since = new Date(Date.now() - 3 * 86_400_000);
  const mailboxes = await syncSentOffers(since);
  await db().setSetting("offer_sync", { at: new Date().toISOString(), mailboxes });
  return Response.json({ mailboxes });
}
