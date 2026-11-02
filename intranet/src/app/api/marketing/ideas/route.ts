import type { PostProvider } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { listIdeas, suggestPosts } from "@/lib/server/social/ideas";
import { getWorkspace } from "@/lib/server/social/store";

// Recherche mit Websuche und zwei Claude-Schritten dauert 1–3 Minuten
export const maxDuration = 300;

/** Vorschläge einer Kundenwelt (?workspace=…), neueste zuerst */
export const GET = withMarketing(async (_actor, request) => {
  const workspace = new URL(request.url).searchParams.get("workspace");
  if (!workspace) return Response.json({ error: "workspace fehlt" }, { status: 400 });
  return Response.json(await listIdeas(workspace));
});

/** Posts vorschlagen: { workspace_id, providers: ["linkedin", …], per_provider?: 1–5, focus? }.
 * Recherchiert Trends per Websuche und liefert die neuen Vorschläge. */
export const POST = withMarketing(async (actor, request) => {
  const body = (await request.json()) as { workspace_id?: string; providers?: PostProvider[]; per_provider?: number; focus?: string };
  if (!body.workspace_id || !(await getWorkspace(body.workspace_id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  if (!Array.isArray(body.providers) || !body.providers.length) return Response.json({ error: "Mindestens eine Plattform wählen" }, { status: 400 });
  const ideas = await suggestPosts(body.workspace_id, { providers: body.providers, per_provider: body.per_provider ?? 3, focus: body.focus, by: actor.email });
  return Response.json(ideas, { status: 201 });
});
