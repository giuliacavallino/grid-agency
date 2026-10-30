import { safeEqual } from "@/lib/server/signature";
import { isFirstWorkday, runDue, type UpdateKind } from "@/lib/server/updates";

export const maxDuration = 300;

/** Automatische Kunden-Updates (vercel.json): freitags das Wochen-Update,
 * am ersten Werktag des Monats das Reporting. Vercel schickt CRON_SECRET mit. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  const kind = new URL(request.url).searchParams.get("kind") as UpdateKind | null;
  if (kind !== "weekly" && kind !== "monthly") return Response.json({ error: "kind fehlt" }, { status: 400 });
  const now = new Date();
  if (kind === "monthly" && !isFirstWorkday(now)) return Response.json({ skipped: "Kein erster Werktag" });
  const { paused, results } = await runDue(kind, now);
  if (paused) return Response.json({ paused });
  const summary = results.map((r) => ({ project_id: r.project_id, status: r.status, error: r.error }));
  return Response.json({ count: results.length, sent: results.filter((r) => r.status === "sent").length, results: summary });
}
