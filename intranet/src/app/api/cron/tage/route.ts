import { safeEqual } from "@/lib/server/signature";
import { dayAutopilotTick } from "@/lib/server/social/day-autopilot";

export const maxDuration = 300;

/** Stündlich (vercel.json): Tage-Autopilot legt Entwürfe zu anstehenden
 * Social-Media-Tagen an (Post bzw. Karussell und Story je Kunde). */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Nicht erlaubt", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ skipped: "ANTHROPIC_API_KEY fehlt" });
  const results = await dayAutopilotTick().catch((error) => ({ error: error instanceof Error ? error.message : "Fehler" }));
  return Response.json({ results });
}
