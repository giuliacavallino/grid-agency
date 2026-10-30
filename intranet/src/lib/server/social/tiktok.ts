import "server-only";
import { readMedia } from "./media";
import { callbackUrl, expiresSoon, inSeconds, readJson } from "./oauth";
import type { PublishInput, PublishOutput } from "./meta";
import { accountRefreshToken, accountToken, markAccountError, saveAccount, updateTokens, type AccountRow } from "./store";

// TikTok Content Posting API: Videos und Foto-Posts direkt aufs Konto.
// Solange die TikTok-App nicht geprüft ist (Audit), erlaubt TikTok nur
// private Posts (SELF_ONLY). Videos lädt der Server in Teilen hoch; Fotos
// holt TikTok per URL von intranet.grid-agency.de (Domain im TikTok-Portal
// bestätigen).
// https://developers.tiktok.com/doc/content-posting-api-get-started

const API = "https://open.tiktokapis.com/v2";
const SCOPES = "user.info.basic,video.publish,video.upload";

export const tiktokConfigured = () => !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET;

export function tiktokAuthorizeUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    response_type: "code",
    scope: SCOPES,
    redirect_uri: callbackUrl("tiktok", origin),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token: string; refresh_expires_in: number; open_id: string; error?: string; error_description?: string };

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, ...params }),
  });
  const data = await readJson<TokenResponse>(response, "TikTok");
  if (data.error) throw new Error(`TikTok: ${data.error_description ?? data.error}`);
  return data;
}

/** TikTok antwortet immer mit { data, error: { code } }; code "ok" heißt Erfolg */
async function api<T>(path: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readJson<{ data: T; error?: { code: string; message: string } }>(response, "TikTok");
  if (data.error && data.error.code !== "ok") throw new Error(`TikTok: ${data.error.message || data.error.code}`);
  return data.data;
}

export async function finishTiktok(code: string, origin: string, workspaceId: string, by: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("tiktok", origin) });
  const info = await api<{ user: { open_id: string; display_name?: string; avatar_url?: string; username?: string } }>(
    "/user/info/?fields=open_id,display_name,avatar_url,username",
    tokens.access_token
  ).catch(() => ({ user: { open_id: tokens.open_id, display_name: undefined, avatar_url: undefined, username: undefined } }));
  return saveAccount({
    workspace_id: workspaceId,
    provider: "tiktok",
    external_id: tokens.open_id,
    name: info.user.display_name ?? "TikTok",
    handle: info.user.username ? `@${info.user.username}` : null,
    avatar_url: info.user.avatar_url ?? null,
    token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: inSeconds(tokens.expires_in),
    refresh_expires_at: inSeconds(tokens.refresh_expires_in),
    connected_by: by,
  });
}

async function accessToken(account: AccountRow) {
  if (!expiresSoon(account.expires_at)) return accountToken(account)!;
  const refresh = accountRefreshToken(account);
  try {
    if (!refresh) throw new Error("kein Refresh-Token");
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
    await updateTokens(account.id, {
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: inSeconds(tokens.expires_in),
      refresh_expires_at: inSeconds(tokens.refresh_expires_in),
    });
    return tokens.access_token;
  } catch (error) {
    await markAccountError(account.id, "TikTok-Zugang abgelaufen, bitte neu verbinden");
    throw error;
  }
}

const MB = 1024 * 1024;

/** Video in Teilen hochladen (TikTok: 5–64 MB je Teil, der letzte nimmt den Rest) */
async function uploadVideo(token: string, path: string, postInfo: Record<string, unknown>) {
  const file = await readMedia(path);
  if (!file) throw new Error("Video nicht gefunden");
  const size = file.bytes.byteLength;
  const chunk = size <= 64 * MB ? size : 10 * MB;
  const count = Math.floor(size / chunk);
  const init = await api<{ publish_id: string; upload_url: string }>("/post/publish/video/init/", token, {
    post_info: postInfo,
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: count },
  });
  for (let i = 0; i < count; i++) {
    const start = i * chunk;
    const end = i === count - 1 ? size : start + chunk;
    const response = await fetch(init.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.mime, "Content-Range": `bytes ${start}-${end - 1}/${size}` },
      body: Buffer.from(file.bytes.subarray(start, end)),
    });
    if (!response.ok) throw new Error(`TikTok-Upload fehlgeschlagen (${response.status})`);
  }
  return init.publish_id;
}

/** Video (ein MP4) oder Foto-Post (bis 35 Bilder) */
export async function publishTiktok(account: AccountRow, input: PublishInput): Promise<PublishOutput> {
  const token = await accessToken(account);
  if (!input.media.length) throw new Error("TikTok braucht ein Video oder Bilder");
  const creator = await api<{ privacy_level_options: string[] }>("/post/publish/creator_info/query/", token, {});
  // Ungeprüfte Apps dürfen nur privat posten
  const privacy = creator.privacy_level_options.includes("PUBLIC_TO_EVERYONE") ? "PUBLIC_TO_EVERYONE" : creator.privacy_level_options[0] ?? "SELF_ONLY";
  const video = input.media.find((m) => m.kind === "video");

  if (video) return { remote_id: await uploadVideo(token, video.path, { title: input.caption.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false }) };
  const result = await api<{ publish_id: string }>("/post/publish/content/init/", token, {
        media_type: "PHOTO",
        post_mode: "DIRECT_POST",
        post_info: { title: input.caption.slice(0, 90), description: input.caption.slice(0, 4000), privacy_level: privacy, disable_comment: false, auto_add_music: true },
        source_info: { source: "PULL_FROM_URL", photo_images: input.media.slice(0, 35).map((m) => m.url), photo_cover_index: 0 },
      });
  // TikTok verarbeitet asynchron; publish_id dient zum Nachverfolgen
  return { remote_id: result.publish_id };
}
