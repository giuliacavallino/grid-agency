import { safeEqual } from "@/lib/server/signature";
import { createWeeklyDrafts } from "@/lib/server/google";

export const maxDuration = 120;

/** Montags früh (vercel.json): Google-Wochen-Updates als Outlook-Entwurf für
 * jede Akte mit auto_draft. Gesendet wird nichts. Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Nicht erlaubt", { status: 401 });
  return Response.json({ results: await createWeeklyDrafts() });
}
