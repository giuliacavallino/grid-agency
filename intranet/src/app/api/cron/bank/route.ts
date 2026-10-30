import { syncBank } from "@/lib/server/bank";
import { bankConfigured } from "@/lib/server/enable-banking";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 120;

/** Abgleichzeiten (deutsche Zeit): 8:30, 11, 15 und 20 Uhr */
const SLOTS = [8, 11, 15, 20];

// formatToParts statt format: de-DE hängt sonst „Uhr“ an
const berlinHour = (date = new Date()) =>
  Number(
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" })
      .formatToParts(date)
      .find((part) => part.type === "hour")!.value
  );

/** Bank-Abgleich (vercel.json). Vercel-Crons laufen in UTC; je Uhrzeit gibt
 * es einen Eintrag für Winter- und einen für Sommerzeit (?slot=8 …). Es läuft
 * nur der, dessen Stunde gerade in Berlin passt. Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const slot = Number(new URL(request.url).searchParams.get("slot"));
  if (SLOTS.includes(slot) && berlinHour() !== slot) {
    return Response.json({ skipped: `nicht ${slot} Uhr in Berlin` });
  }
  if (!bankConfigured()) {
    return Response.json({ error: "ENABLE_BANKING_APP_ID / ENABLE_BANKING_PRIVATE_KEY fehlen" }, { status: 503 });
  }
  return Response.json(await syncBank());
}
