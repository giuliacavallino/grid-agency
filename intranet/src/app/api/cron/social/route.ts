import { safeEqual } from "@/lib/server/signature";
import { publishDue } from "@/lib/server/social/publish";

export const maxDuration = 300;

/** Geplante Posts veröffentlichen (vercel.json). Läuft zu festen Zeiten; alles,
 * was bis dahin fällig ist, geht raus. Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  return Response.json({ published: await publishDue() });
}
