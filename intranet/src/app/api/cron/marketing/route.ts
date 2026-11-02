import { safeEqual } from "@/lib/server/signature";
import { autopilotTick } from "@/lib/server/social/ideas";
import { agentTick } from "@/lib/server/agent/runner";

export const maxDuration = 300;

/** Stündlich (vercel.json): Autopilot einer fälligen Kundenwelt und
 * Aufgaben, die an den Agenten übergeben wurden. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ skipped: "ANTHROPIC_API_KEY fehlt" });
  const autopilot = await autopilotTick().catch((error) => ({ error: error instanceof Error ? error.message : "Fehler" }));
  const agent = await agentTick().catch((error) => ({ error: error instanceof Error ? error.message : "Fehler" }));
  return Response.json({ autopilot, agent });
}
