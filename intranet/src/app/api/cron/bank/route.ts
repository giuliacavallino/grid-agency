import { syncBank } from "@/lib/server/bank";
import { bankConfigured } from "@/lib/server/enable-banking";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 120;

/** Täglicher Bank-Abgleich (vercel.json); Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  if (!bankConfigured()) {
    return Response.json({ error: "ENABLE_BANKING_APP_ID / ENABLE_BANKING_PRIVATE_KEY fehlen" }, { status: 503 });
  }
  return Response.json(await syncBank());
}
