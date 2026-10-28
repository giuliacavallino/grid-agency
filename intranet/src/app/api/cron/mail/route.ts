import { appGraph, listInboxSince, MAILBOX_PATH } from "@/lib/server/graph-app";
import { db } from "@/lib/server/db";
import { ingestMail } from "@/lib/server/mail-ingest";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 300;

type Subscription = { id: string; expirationDateTime: string };

// Graph-Abos auf Mails laufen nach höchstens ~7 Tagen ab; der tägliche Cron
// verlängert sie und holt verpasste Mails der letzten 48 Stunden nach.
const LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;

async function ensureSubscription(origin: string) {
  const store = db();
  const expirationDateTime = new Date(Date.now() + LIFETIME_MS).toISOString();
  const saved = await store.getSetting<Subscription>("mail_subscription");

  if (saved) {
    try {
      const renewed = await appGraph<Subscription>(`/subscriptions/${saved.id}`, {
        method: "PATCH",
        body: JSON.stringify({ expirationDateTime }),
      });
      await store.setSetting("mail_subscription", { id: renewed.id, expirationDateTime: renewed.expirationDateTime });
      return "verlängert";
    } catch {
      // Abo abgelaufen oder gelöscht → neu anlegen
    }
  }

  const created = await appGraph<Subscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "created",
      notificationUrl: `${origin}/api/webhooks/mail`,
      resource: `${MAILBOX_PATH}/mailFolders('inbox')/messages`,
      expirationDateTime,
      clientState: process.env.MAIL_WEBHOOK_SECRET,
    }),
  });
  await store.setSetting("mail_subscription", { id: created.id, expirationDateTime: created.expirationDateTime });
  return "angelegt";
}

/** Täglich per Vercel Cron (vercel.json); Vercel schickt CRON_SECRET mit. */
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
  const subscription = await ensureSubscription(origin).catch((error: Error) => `Fehler: ${error.message}`);

  const counts: Record<string, number> = {};
  const mails = await listInboxSince(new Date(Date.now() - 48 * 60 * 60 * 1000));
  for (const mail of mails) {
    const result = await ingestMail(mail).catch(() => "fehler");
    counts[result] = (counts[result] ?? 0) + 1;
  }
  return Response.json({ subscription, checked: mails.length, counts });
}
