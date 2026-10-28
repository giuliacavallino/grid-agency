import "server-only";
import { MAILBOXES, SHARED_MAILBOX } from "@/lib/config";
import { db } from "./db";
import { appGraph, mailboxPath } from "./graph-app";

type Subscription = { id: string; expirationDateTime: string };
type Subscriptions = Record<string, Subscription>;

const KEY = "mail_subscriptions";

// Graph-Abos auf Mails laufen nach höchstens ~7 Tagen ab; der tägliche Cron
// verlängert sie.
const LIFETIME_MS = 6 * 24 * 60 * 60 * 1000;

/** Gespeicherte Abos je Postfach; übernimmt das frühere einzelne hello@-Abo. */
async function load(): Promise<Subscriptions> {
  const store = db();
  const saved = await store.getSetting<Subscriptions>(KEY);
  if (saved) return saved;
  const legacy = await store.getSetting<Subscription>("mail_subscription");
  return legacy ? { [SHARED_MAILBOX]: legacy } : {};
}

export async function mailboxForSubscription(id: string) {
  const all = await load();
  return Object.entries(all).find(([, sub]) => sub.id === id)?.[0] ?? null;
}

async function ensure(mailbox: string, saved: Subscription | undefined, origin: string) {
  const expirationDateTime = new Date(Date.now() + LIFETIME_MS).toISOString();
  if (saved) {
    try {
      const renewed = await appGraph<Subscription>(`/subscriptions/${saved.id}`, {
        method: "PATCH",
        body: JSON.stringify({ expirationDateTime }),
      });
      return { status: "verlängert", sub: { id: renewed.id, expirationDateTime: renewed.expirationDateTime } };
    } catch {
      // Abo abgelaufen oder gelöscht → neu anlegen
    }
  }
  const created = await appGraph<Subscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      changeType: "created",
      notificationUrl: `${origin}/api/webhooks/mail`,
      resource: `${mailboxPath(mailbox)}/mailFolders('inbox')/messages`,
      expirationDateTime,
      clientState: process.env.MAIL_WEBHOOK_SECRET,
    }),
  });
  return { status: "angelegt", sub: { id: created.id, expirationDateTime: created.expirationDateTime } };
}

/** Legt für jedes Postfach ein Abo an bzw. verlängert es. */
export async function ensureSubscriptions(origin: string) {
  const all = await load();
  const status: Record<string, string> = {};
  for (const { address } of MAILBOXES) {
    try {
      const result = await ensure(address, all[address], origin);
      all[address] = result.sub;
      status[address] = result.status;
    } catch (error) {
      status[address] = `Fehler: ${(error as Error).message}`;
    }
  }
  await db().setSetting(KEY, all);
  return status;
}
