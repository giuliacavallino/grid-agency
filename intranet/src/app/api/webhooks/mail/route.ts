import { after } from "next/server";
import { getMail } from "@/lib/server/graph-app";
import { ingestMail } from "@/lib/server/mail-ingest";
import { mailboxForSubscription } from "@/lib/server/mail-subscriptions";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 60;

type Notification = { subscriptionId?: string; clientState?: string; resourceData?: { id?: string } };

/** Microsoft-Graph-Benachrichtigung: neue Mail im Posteingang eines der
 * Postfächer aus MAILBOXES (ein Abo je Postfach). */
export async function POST(request: Request) {
  // Beim Anlegen des Abos prüft Graph die URL mit einem validationToken.
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, { headers: { "Content-Type": "text/plain" } });
  }

  const secret = process.env.MAIL_WEBHOOK_SECRET;
  if (!secret) return new Response("Nicht eingerichtet", { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { value?: Notification[] };
  const notifications = (body.value ?? []).filter(
    (n) => n.clientState && safeEqual(n.clientState, secret) && n.resourceData?.id && n.subscriptionId
  );

  // Graph erwartet eine schnelle Antwort; verarbeitet wird danach.
  after(async () => {
    for (const n of notifications) {
      try {
        const mailbox = await mailboxForSubscription(n.subscriptionId!);
        if (!mailbox) continue;
        await ingestMail(await getMail(mailbox, n.resourceData!.id!));
      } catch (error) {
        console.error("Mail konnte nicht verarbeitet werden:", error);
      }
    }
  });
  return new Response(null, { status: 202 });
}
