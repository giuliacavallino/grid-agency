import { DEMO } from "@/lib/config";
import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { syncSentOffers } from "@/lib/server/offers";

export const maxDuration = 300;

/** Letzter Abgleich der gesendeten Angebote */
export const GET = withUser(async () => {
  return Response.json({ last: await db().getSetting("offer_sync") });
}, ["sales"]);

/** Abgleich auf Knopfdruck: gesendete Mails der letzten `tage` (Standard 14, höchstens 60) */
export const POST = withUser(async (_user, request) => {
  if (DEMO) return Response.json({ mailboxes: {} });
  if (!process.env.MS_CLIENT_SECRET || !process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Mail-Zugriff oder Claude ist nicht eingerichtet" }, { status: 503 });
  }
  const days = Math.min(60, Math.max(1, Number(new URL(request.url).searchParams.get("tage")) || 14));
  const mailboxes = await syncSentOffers(new Date(Date.now() - days * 86_400_000));
  await db().setSetting("offer_sync", { at: new Date().toISOString(), mailboxes });
  return Response.json({ mailboxes });
}, ["sales"]);
