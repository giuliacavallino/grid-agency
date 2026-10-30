import "server-only";
import type { MediaItem } from "@/lib/marketing";
import { archiveMedia } from "./sharepoint";
import { getPost, getWorkspace, listAccounts, updatePost } from "./store";

// Eingaben für Posts prüfen (vom Team oder vom Agenten)

const PATH = /^[0-9a-f-]{36}\/[a-z0-9-_]+\.[a-z0-9]+$/i;

export type PostBody = {
  workspace_id?: string;
  caption?: string;
  media?: MediaItem[];
  account_ids?: string[];
  scheduled_at?: string | null;
  /** true: sofort veröffentlichen */
  publish_now?: boolean;
  status?: "draft" | "scheduled";
};

export async function validatePost(body: PostBody, workspaceId: string) {
  if (!(await getWorkspace(workspaceId))) return "Kundenwelt nicht gefunden";
  if (body.caption !== undefined && (typeof body.caption !== "string" || body.caption.length > 5000)) return "Text zu lang (max. 5000 Zeichen)";
  if (body.media !== undefined) {
    if (!Array.isArray(body.media) || body.media.length > 35) return "Höchstens 35 Medien";
    if (body.media.some((m) => !PATH.test(m?.path ?? "") || !/^(image|video)$/.test(m.kind))) return "Medien zuerst über /api/marketing/media oder den Canva-Export ablegen";
  }
  if (body.account_ids !== undefined) {
    const own = new Set((await listAccounts(workspaceId)).filter((a) => a.provider !== "canva").map((a) => a.id));
    if (!Array.isArray(body.account_ids) || body.account_ids.some((id) => !own.has(id))) return "Kanäle gehören nicht zu dieser Kundenwelt";
  }
  if (body.scheduled_at && Number.isNaN(Date.parse(body.scheduled_at))) return "scheduled_at ist kein Datum (ISO 8601)";
  return null;
}

/** Nur die Felder, die ein Post speichern darf */
export const cleanMedia = (media: MediaItem[] | undefined) =>
  media?.map(({ path, mime, kind, width, height, canva_design_id, sharepoint_url }) => ({ path, mime, kind, width, height, canva_design_id, sharepoint_url }));

/** Nach der Antwort: Medien in den SharePoint-Ordner der Kundenwelt legen */
export async function archivePostMedia(postId: string) {
  const post = await getPost(postId);
  if (!post || !post.media.some((m) => !m.sharepoint_url)) return;
  const links = new Map((await archiveMedia(post.workspace_id, post.media)).map((m) => [m.path, m.sharepoint_url]));
  // Nur die Ablage-Links nachtragen; der Post kann sich inzwischen geändert haben
  const fresh = await getPost(postId);
  if (!fresh || !fresh.media.some((m) => !m.sharepoint_url && links.get(m.path))) return;
  await updatePost(postId, { media: fresh.media.map((m) => ({ ...m, sharepoint_url: m.sharepoint_url ?? links.get(m.path) })) });
}
