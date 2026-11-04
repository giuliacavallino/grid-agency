import "server-only";
import type { ChannelProfile, MediaItem, ProfilePost } from "@/lib/marketing";
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

export type PublishInput = { caption: string; media: Required<Pick<MediaItem, "url" | "kind" | "mime" | "path">>[]; format?: "feed" | "story" | "carousel" };
export type PublishOutput = { remote_id: string; url?: string };

/** Facebook-Seite: Text, ein Bild, mehrere Bilder oder ein Video */
export async function publishFacebook(account: AccountRow, input: PublishInput): Promise<PublishOutput> {
  const token = accountToken(account)!;
  const pageId = account.external_id;
  const [first] = input.media;
  if (input.format === "story") {
    // Seiten-Story: Foto unveröffentlicht hochladen, dann als Story; Video über video_stories
    if (!first) throw new Error("Eine Story braucht ein Bild oder Video");
    if (first.kind === "video") {
      const start = await post<{ video_id: string; upload_url: string }>(`/${pageId}/video_stories`, { upload_phase: "start", access_token: token });
      const upload = await fetch(start.upload_url, { method: "POST", headers: { Authorization: `OAuth ${token}`, file_url: first.url } });
      if (!upload.ok) throw new Error("Facebook: Story-Video konnte nicht hochgeladen werden");
      const done = await post<{ post_id?: string }>(`/${pageId}/video_stories`, { upload_phase: "finish", video_id: start.video_id, access_token: token });
      return { remote_id: done.post_id ?? start.video_id };
    }
    const photo = await post<{ id: string }>(`/${pageId}/photos`, { url: first.url, published: "false", access_token: token });
    const story = await post<{ post_id?: string; id?: string }>(`/${pageId}/photo_stories`, { photo_id: photo.id, access_token: token });
    return { remote_id: story.post_id ?? story.id ?? photo.id };
  }
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
  if (input.format === "story") {
    // Story: ein Bild oder Video im Hochformat, ohne Caption
    const [only] = input.media;
    creation = (await post<{ id: string }>(`/${igId}/media`, { media_type: "STORIES", ...(only.kind === "video" ? { video_url: only.url } : { image_url: only.url }), access_token: token })).id;
    if (only.kind === "video") await waitForContainer(creation, token);
    const story = await post<{ id: string }>(`/${igId}/media_publish`, { creation_id: creation, access_token: token });
    return { remote_id: story.id };
  }
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

// ---------- Profil lesen (Cockpit-Kachel) ----------

export type ProfileRead = { profile: ChannelProfile; posts: ProfilePost[]; error?: string };

const failText = (error: unknown) => (error instanceof Error ? error.message : "unbekannter Fehler");

/** Instagram-Business-Konto: Profil und die letzten 12 Beiträge (instagram_basic) */
export async function readInstagram(account: AccountRow): Promise<ProfileRead> {
  const token = accountToken(account)!;
  const igId = account.external_id;
  const fallbackHandle = account.handle?.replace(/^@/, "") ?? null;
  const profile: ChannelProfile = { name: account.name, handle: account.handle, avatar: account.avatar_url, url: fallbackHandle ? `https://www.instagram.com/${fallbackHandle}/` : null };
  const errors: string[] = [];
  try {
    const user = await get<{ username?: string; name?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number; media_count?: number; biography?: string; website?: string }>(
      `/${igId}`,
      { fields: "username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website", access_token: token }
    );
    Object.assign(profile, {
      name: user.name || user.username || account.name,
      handle: user.username ? `@${user.username}` : profile.handle,
      avatar: user.profile_picture_url ?? profile.avatar,
      followers: user.followers_count,
      following: user.follows_count,
      posts: user.media_count,
      bio: [user.biography, user.website].filter(Boolean).join("\n") || undefined,
      url: user.username ? `https://www.instagram.com/${user.username}/` : profile.url,
    });
  } catch (error) {
    errors.push(`Profil: ${failText(error)}`);
  }
  let posts: ProfilePost[] = [];
  try {
    const media = await get<{ data: { id: string; caption?: string; media_type?: string; media_url?: string; thumbnail_url?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number }[] }>(
      `/${igId}/media`,
      { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count", limit: "12", access_token: token }
    );
    posts = media.data.map((m) => ({
      id: m.id,
      image: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? m.thumbnail_url ?? null,
      caption: m.caption ?? "",
      url: m.permalink ?? null,
      date: m.timestamp ?? null,
      type: m.media_type === "VIDEO" ? "video" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image",
      likes: m.like_count,
      comments: m.comments_count,
    }));
  } catch (error) {
    errors.push(`Beiträge: ${failText(error)}`);
  }
  return { profile, posts, error: errors.length ? errors.join(" · ") : undefined };
}

type FacebookPost = {
  id: string;
  message?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time?: string;
  attachments?: { data?: { media_type?: string; type?: string }[] };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

/** Facebook-Seite: Profil und die letzten 12 Beiträge (pages_read_engagement) */
export async function readFacebook(account: AccountRow): Promise<ProfileRead> {
  const token = accountToken(account)!;
  const pageId = account.external_id;
  const profile: ChannelProfile = { name: account.name, handle: account.handle, avatar: account.avatar_url, url: `https://www.facebook.com/${pageId}` };
  const errors: string[] = [];
  try {
    type Page = { name?: string; username?: string; picture?: { data?: { url?: string } }; fan_count?: number; followers_count?: number; about?: string; link?: string };
    // username gibt es nicht bei jeder Seite/Version; dann ohne erneut fragen
    const page = await get<Page>(`/${pageId}`, { fields: "name,username,picture.type(large),fan_count,followers_count,about,link", access_token: token }).catch(() =>
      get<Page>(`/${pageId}`, { fields: "name,picture.type(large),fan_count,followers_count,about,link", access_token: token })
    );
    Object.assign(profile, {
      name: page.name ?? account.name,
      handle: page.username ? `@${page.username}` : profile.handle,
      avatar: page.picture?.data?.url ?? profile.avatar,
      followers: page.followers_count ?? page.fan_count,
      bio: page.about || undefined,
      url: page.link ?? (page.username ? `https://www.facebook.com/${page.username}` : profile.url),
    });
  } catch (error) {
    errors.push(`Seite: ${failText(error)}`);
  }
  let posts: ProfilePost[] = [];
  try {
    const base = "id,message,full_picture,permalink_url,created_time";
    // Mit Reaktionen/Kommentaren; falls die Seite das nicht erlaubt, ohne
    const feed = await get<{ data: FacebookPost[] }>(`/${pageId}/posts`, {
      fields: `${base},attachments{media_type,type},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)`,
      limit: "12",
      access_token: token,
    }).catch(() => get<{ data: FacebookPost[] }>(`/${pageId}/posts`, { fields: base, limit: "12", access_token: token }));
    posts = feed.data.map((p) => {
      const media = p.attachments?.data?.[0];
      const kind = `${media?.media_type ?? ""} ${media?.type ?? ""}`.toLowerCase();
      return {
        id: p.id,
        image: p.full_picture ?? null,
        caption: p.message ?? "",
        url: p.permalink_url ?? `https://www.facebook.com/${p.id}`,
        date: p.created_time ?? null,
        type: kind.includes("video") ? "video" : kind.includes("album") ? "carousel" : p.full_picture ? "image" : "text",
        likes: p.reactions?.summary?.total_count,
        comments: p.comments?.summary?.total_count,
      };
    });
  } catch (error) {
    errors.push(`Beiträge: ${failText(error)}`);
  }
  return { profile, posts, error: errors.length ? errors.join(" · ") : undefined };
}
