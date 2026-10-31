import { safeEqual } from "@/lib/server/signature";
import { autoReply, syncComments } from "@/lib/server/social/community";
import { publishDue } from "@/lib/server/social/publish";

export const maxDuration = 300;

/** Geplante Posts veröffentlichen und LinkedIn-Kommentare betreuen (vercel.json). Läuft zu festen Zeiten; alles,
 * was bis dahin fällig ist, geht raus. Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const published = await publishDue();
  // LinkedIn-Kommentare abrufen und mit Autopilot beantworten
  const comments = await syncComments().catch((error) => [{ account: "alle", error: String(error) }]);
  const replied = await autoReply().catch((error) => [{ id: "-", action: "error", error: String(error) }]);
  return Response.json({ published, comments, replied });
}
