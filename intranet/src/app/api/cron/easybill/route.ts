import { syncEasybill } from "@/lib/server/easybill";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 120;

/** Täglicher Abgleich mit easybill (vercel.json); Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  if (!process.env.EASYBILL_API_KEY) {
    return Response.json({ error: "EASYBILL_API_KEY fehlt" }, { status: 503 });
  }
  return Response.json(await syncEasybill());
}
