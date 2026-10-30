import { runSeries } from "@/lib/server/billing-series";
import { safeEqual } from "@/lib/server/signature";

export const maxDuration = 300;

/** Täglich (vercel.json): fällige Serienrechnungen erzeugen, festschreiben und versenden */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const run = await runSeries();
  if (run.errors.length) console.error("Serienrechnungen", run.errors);
  return Response.json(run);
}
