import { MAILBOXES } from "@/lib/config";
import { listInboxSince } from "@/lib/server/graph-app";
import { ingestMail } from "@/lib/server/mail-ingest";
import { ensureSubscriptions } from "@/lib/server/mail-subscriptions";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 300;

/** Täglich per Vercel Cron (vercel.json); Vercel schickt CRON_SECRET mit.
 * Verlängert die Graph-Abos aller Postfächer und holt verpasste Mails der
 * letzten 48 Stunden nach. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  if (!process.env.MS_CLIENT_SECRET || !process.env.MAIL_WEBHOOK_SECRET) {
    return Response.json({ error: "MS_CLIENT_SECRET / MAIL_WEBHOOK_SECRET fehlen" }, { status: 503 });
  }

  // Produktions-URL für Graph; Preview-Deployments sind meist geschützt.
  const origin = process.env.INTRANET_URL ?? new URL(request.url).origin;
  const subscriptions = await ensureSubscriptions(origin);

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const mailboxes: Record<string, { checked: number; counts: Record<string, number> } | { error: string }> = {};
  for (const { address } of MAILBOXES) {
    try {
      const mails = await listInboxSince(address, since);
      const counts: Record<string, number> = {};
      for (const mail of mails) {
        const result = await ingestMail(mail).catch(() => "fehler");
        counts[result] = (counts[result] ?? 0) + 1;
      }
      mailboxes[address] = { checked: mails.length, counts };
    } catch (error) {
      mailboxes[address] = { error: (error as Error).message };
    }
  }
  return Response.json({ subscriptions, mailboxes });
}
