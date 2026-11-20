import { withMarketing } from "@/lib/server/social/auth";
import { ASSIST_ACTIONS, ASSIST_PROVIDERS, assistCaption, type AssistAction } from "@/lib/server/social/assist";
import { getWorkspace } from "@/lib/server/social/store";
import type { PostProvider } from "@/lib/marketing";

export const maxDuration = 120;

const PATH = /^[0-9a-f-]{36}\/[a-z0-9-_]+\.[a-z0-9]+$/i;

/** KI-Assistent für Caption und Hashtags:
 * { workspace_id, action: write|improve|shorten|adapt|hashtags|emojis, caption, brief?, platforms[], platform? (für adapt), image? (Medienpfad) }
 * → { variants: string[], hashtags?: string[] } */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json().catch(() => ({}))) as {
    workspace_id?: string;
    action?: string;
    caption?: unknown;
    brief?: unknown;
    platforms?: unknown;
    platform?: unknown;
    image?: unknown;
  };
  if (!body.workspace_id || !(await getWorkspace(body.workspace_id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const action = body.action as AssistAction;
  if (!ASSIST_ACTIONS.includes(action)) return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
  const caption = typeof body.caption === "string" ? body.caption.slice(0, 5000) : "";
  const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 1000) : "";
  const platforms = Array.isArray(body.platforms) ? [...new Set(body.platforms.filter((p): p is PostProvider => ASSIST_PROVIDERS.includes(p as PostProvider)))] : [];
  const platform = ASSIST_PROVIDERS.includes(body.platform as PostProvider) ? (body.platform as PostProvider) : undefined;
  const image = typeof body.image === "string" && PATH.test(body.image) ? body.image : undefined;

  if (action === "write" && !brief && !caption.trim() && !image) return Response.json({ error: "Kurz die Idee eingeben" }, { status: 400 });
  if (["improve", "shorten", "adapt", "emojis"].includes(action) && !caption.trim()) return Response.json({ error: "Erst einen Text schreiben" }, { status: 400 });
  if (action === "adapt" && !platform) return Response.json({ error: "Plattform fehlt" }, { status: 400 });

  return Response.json(await assistCaption(body.workspace_id, { action, caption, brief, platforms, platform, image }));
});
