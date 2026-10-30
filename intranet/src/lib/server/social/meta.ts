import "server-only";
import type { MediaItem } from "@/lib/marketing";
import { callbackUrl, inSeconds, readJson } from "./oauth";
import { accountToken, saveAccount, type AccountRow } from "./store";

// Meta Graph API: Facebook-Seiten und die damit verknüpften Instagram-
// Business-Konten. Ein Login verbindet alle Seiten, auf die das Konto Zugriff
// hat; Seiten-Tokens aus einem langlebigen User-Token laufen nicht ab.
// Braucht in der Meta-App: Facebook Login for Business mit den Rechten
// pages_show_list, pages_read_engagement, pages_manage_posts,
// instagram_basic, instagram_content_publish, business_management.

const VERSION = process.env.META_GRAPH_VERSION ?? "v23.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

export const metaConfigured = () => !!process.env.META_APP_ID && !!process.env.META_APP_SECRET;

export function metaAuthorizeUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: callbackUrl("meta", origin),
    state,
    response_type: "code",
    scope: SCOPES,
  });
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${params}`;
}

const get = async <T>(path: string, params: Record<string, string>) =>
  readJson<T>(await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`), "Meta");

const post = async <T>(path: string, params: Record<string, string>) =>
  readJson<T>(await fetch(`${GRAPH}${path}`, { method: "POST", body: new URLSearchParams(params) }), "Meta");

/** Rückkehr vom Login: alle Seiten und Instagram-Konten der Kundenwelt speichern */
export async function finishMeta(code: string, origin: string, workspaceId: string, by: string) {
  const app = { client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET! };
  const short = await get<{ access_token: string }>("/oauth/access_token", { ...app, redirect_uri: callbackUrl("meta", origin), code });
  const long = await get<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    ...app,
    grant_type: "fb_exchange_token",
    fb_exchange_token: short.access_token,
  });
  const pages = await get<{
    data: { id: string; name: string; access_token: string; picture?: { data?: { url?: string } }; instagram_business_account?: { id: string; username?: string; name?: string; profile_picture_url?: string } }[];
  }>("/me/accounts", {
    access_token: long.access_token,
    fields: "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
    limit: "100",
  });
  if (!pages.data.length) throw new Error("Keine Facebook-Seite freigegeben. Beim Login die Seiten des Kunden auswählen.");

  const saved: AccountRow[] = [];
  for (const page of pages.data) {
    saved.push(
      await saveAccount({
        workspace_id: workspaceId,
        provider: "facebook",
        external_id: page.id,
        name: page.name,
        avatar_url: page.picture?.data?.url ?? null,
        token: page.access_token,
        expires_at: null,
        meta: { user_token_expires_at: inSeconds(long.expires_in) },
        connected_by: by,
      })
    );
    const ig = page.instagram_business_account;
    if (ig) {
      saved.push(
        await saveAccount({
          workspace_id: workspaceId,
          provider: "instagram",
          external_id: ig.id,
          name: ig.name || ig.username || page.name,
          handle: ig.username ? `@${ig.username}` : null,
          avatar_url: ig.profile_picture_url ?? null,
          // Instagram wird über das Token der verknüpften Facebook-Seite angesprochen
          token: page.access_token,
          expires_at: null,
          meta: { page_id: page.id },
          connected_by: by,
        })
      );
    }
  }
  return saved;
}

export type PublishInput = { caption: string; media: Required<Pick<MediaItem, "url" | "kind" | "mime" | "path">>[] };
export type PublishOutput = { remote_id: string; url?: string };

/** Facebook-Seite: Text, ein Bild, mehrere Bilder oder ein Video */
export async function publishFacebook(account: AccountRow, input: PublishInput): Promise<PublishOutput> {
  const token = accountToken(account)!;
  const pageId = account.external_id;
  const [first] = input.media;
  if (!first) {
    const result = await post<{ id: string }>(`/${pageId}/feed`, { message: input.caption, access_token: token });
    return { remote_id: result.id, url: `https://www.facebook.com/${result.id}` };
  }
  if (first.kind === "video") {
    const result = await post<{ id: string }>(`/${pageId}/videos`, { file_url: first.url, description: input.caption, access_token: token });
    return { remote_id: result.id, url: `https://www.facebook.com/${pageId}/videos/${result.id}` };
  }
  if (input.media.length === 1) {
    const result = await post<{ id: string; post_id?: string }>(`/${pageId}/photos`, { url: first.url, caption: input.caption, access_token: token });
    return { remote_id: result.post_id ?? result.id, url: `https://www.facebook.com/${result.post_id ?? result.id}` };
  }
  // Mehrere Bilder: erst unveröffentlicht hochladen, dann als ein Beitrag
  const ids: string[] = [];
  for (const item of input.media.filter((m) => m.kind === "image").slice(0, 10)) {
    const photo = await post<{ id: string }>(`/${pageId}/photos`, { url: item.url, published: "false", access_token: token });
    ids.push(photo.id);
  }
  const params: Record<string, string> = { message: input.caption, access_token: token };
  ids.forEach((id, index) => (params[`attached_media[${index}]`] = JSON.stringify({ media_fbid: id })));
  const result = await post<{ id: string }>(`/${pageId}/feed`, params);
  return { remote_id: result.id, url: `https://www.facebook.com/${result.id}` };
}

async function waitForContainer(id: string, token: string) {
  // Videos verarbeitet Instagram erst; bis zu ~4 Minuten warten
  for (let i = 0; i < 48; i++) {
    const status = await get<{ status_code: string; status?: string }>(`/${id}`, { fields: "status_code,status", access_token: token });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error(`Instagram: ${status.status ?? status.status_code}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Instagram verarbeitet das Video noch, bitte später erneut posten");
}

/** Instagram: Bild, Karussell (bis 10) oder Reel. Text allein geht bei Instagram nicht. */
export async function publishInstagram(account: AccountRow, input: PublishInput): Promise<PublishOutput> {
  const token = accountToken(account)!;
  const igId = account.external_id;
  if (!input.media.length) throw new Error("Instagram braucht ein Bild oder Video");
  const item = (m: PublishInput["media"][number], extra: Record<string, string>) =>
    m.kind === "video" ? { media_type: "REELS", video_url: m.url, ...extra } : { image_url: m.url, ...extra };

  let creation: string;
  if (input.media.length === 1) {
    const [only] = input.media;
    creation = (await post<{ id: string }>(`/${igId}/media`, { ...item(only, { caption: input.caption }), access_token: token })).id;
    if (only.kind === "video") await waitForContainer(creation, token);
  } else {
    const children: string[] = [];
    for (const m of input.media.slice(0, 10)) {
      const child = (await post<{ id: string }>(`/${igId}/media`, { ...item(m, { is_carousel_item: "true" }), ...(m.kind === "video" ? { media_type: "VIDEO" } : {}), access_token: token })).id;
      if (m.kind === "video") await waitForContainer(child, token);
      children.push(child);
    }
    creation = (await post<{ id: string }>(`/${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: input.caption, access_token: token })).id;
  }
  const published = await post<{ id: string }>(`/${igId}/media_publish`, { creation_id: creation, access_token: token });
  const permalink = await get<{ permalink?: string }>(`/${published.id}`, { fields: "permalink", access_token: token }).catch(() => ({ permalink: undefined }));
  return { remote_id: published.id, url: permalink.permalink };
}
