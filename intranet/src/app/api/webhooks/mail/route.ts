import { after } from "next/server";
import { getMail } from "@/lib/server/graph-app";
import { ingestMail } from "@/lib/server/mail-ingest";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 60;

type Notification = { clientState?: string; resourceData?: { id?: string } };

/** Microsoft-Graph-Benachrichtigung: neue Mail im Posteingang von hello@. */
export async function POST(request: Request) {
  // Beim Anlegen des Abos prüft Graph die URL mit einem validationToken.
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    return new Response(validationToken, { headers: { "Content-Type": "text/plain" } });
  }

  const secret = process.env.MAIL_WEBHOOK_SECRET;
  if (!secret) return new Response("Nicht eingerichtet", { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { value?: Notification[] };
  const ids = (body.value ?? [])
    .filter((n) => n.clientState && safeEqual(n.clientState, secret) && n.resourceData?.id)
    .map((n) => n.resourceData!.id!);

  // Graph erwartet eine schnelle Antwort; verarbeitet wird danach.
  after(async () => {
    for (const id of ids) {
      try {
        await ingestMail(await getMail(id));
      } catch (error) {
        console.error("Mail konnte nicht verarbeitet werden:", error);
      }
    }
  });
  return new Response(null, { status: 202 });
}
