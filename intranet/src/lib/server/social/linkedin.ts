import "server-only";
import { callbackUrl, expiresSoon, inSeconds, readJson } from "./oauth";
import type { ChannelProfile, ProfilePost } from "@/lib/marketing";
import type { ProfileRead, PublishInput, PublishOutput } from "./meta";
import { accountRefreshToken, accountToken, markAccountError, saveAccount, updateTokens, type AccountRow } from "./store";

// LinkedIn Community Management API: Posts auf Unternehmensseiten. Braucht
// eine eigene LinkedIn-App, in der nur das Produkt „Community Management
// API“ freigeschaltet ist (LinkedIn verlangt das so); deshalb eigene Keys
// LINKEDIN_CM_CLIENT_ID/SECRET neben der Lead-Sync-App.
// https://learn.microsoft.com/linkedin/marketing/community-management/

const SCOPES = "r_organization_social w_organization_social rw_organization_admin";
const REST = "https://api.linkedin.com/rest";

export const linkedinConfigured = () => !!process.env.LINKEDIN_CM_CLIENT_ID && !!process.env.LINKEDIN_CM_CLIENT_SECRET;

/** LinkedIn versioniert monatlich (YYYYMM) und schaltet alte Versionen nach
 * etwa einem Jahr ab; Standard ist der Monat vor drei Monaten. */
function apiVersion() {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 3);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "LinkedIn-Version": apiVersion(),
  "X-Restli-Protocol-Version": "2.0.0",
});

export function linkedinAuthorizeUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CM_CLIENT_ID ?? "",
    redirect_uri: callbackUrl("linkedin", origin),
    state,
    scope: SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number };

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.LINKEDIN_CM_CLIENT_ID!, client_secret: process.env.LINKEDIN_CM_CLIENT_SECRET!, ...params }),
  });
  return readJson<TokenResponse>(response, "LinkedIn");
}

/** Rückkehr vom Login: alle Unternehmensseiten speichern, auf denen das Konto Admin ist */
export async function finishLinkedin(code: string, origin: string, workspaceId: string, by: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("linkedin", origin) });
  const acls = await readJson<{ elements: { organization: string; role: string; state: string }[] }>(
    await fetch(`${REST}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=100`, { headers: headers(tokens.access_token) }),
    "LinkedIn"
  );
  if (!acls.elements.length) throw new Error("Das LinkedIn-Konto ist auf keiner Unternehmensseite Admin");
  const saved: AccountRow[] = [];
  for (const acl of acls.elements) {
    const id = acl.organization.split(":").pop()!;
    const org = await readJson<{ localizedName?: string; vanityName?: string }>(
      await fetch(`${REST}/organizations/${id}`, { headers: headers(tokens.access_token) }),
      "LinkedIn"
    ).catch(() => ({ localizedName: undefined, vanityName: undefined }));
    saved.push(
      await saveAccount({
        workspace_id: workspaceId,
        provider: "linkedin",
        external_id: acl.organization,
        name: org.localizedName ?? `Unternehmensseite ${id}`,
        handle: org.vanityName ? `linkedin.com/company/${org.vanityName}` : null,
        token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: inSeconds(tokens.expires_in),
        refresh_expires_at: inSeconds(tokens.refresh_token_expires_in),
        connected_by: by,
      })
    );
  }
  return saved;
}

async function accessToken(account: AccountRow) {
  if (!expiresSoon(account.expires_at)) return accountToken(account)!;
  const refresh = accountRefreshToken(account);
  if (!refresh) {
    await markAccountError(account.id, "LinkedIn-Zugang abgelaufen (60 Tage), bitte neu verbinden");
    throw new Error("LinkedIn-Zugang abgelaufen, bitte neu verbinden");
  }
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  await updateTokens(account.id, {
    token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: inSeconds(tokens.expires_in),
    ...(tokens.refresh_token_expires_in ? { refresh_expires_at: inSeconds(tokens.refresh_token_expires_in) } : {}),
  });
  return tokens.access_token;
}

/** Bild zu LinkedIn hochladen; liefert die Bild-URN für den Post */
async function uploadImage(token: string, owner: string, url: string) {
  const init = await readJson<{ value: { uploadUrl: string; image: string } }>(
    await fetch(`${REST}/images?action=initializeUpload`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ initializeUploadRequest: { owner } }),
    }),
    "LinkedIn"
  );
  const file = await fetch(url);
  if (!file.ok) throw new Error("Bild konnte nicht geladen werden");
  const upload = await fetch(init.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: await file.arrayBuffer() });
  if (!upload.ok) throw new Error(`LinkedIn-Upload fehlgeschlagen (${upload.status})`);
  return init.value.image;
}

/** Post auf der Unternehmensseite: Text, ein Bild oder mehrere Bilder.
 * Videos laufen bei LinkedIn über einen eigenen Upload und folgen später. */
export async function publishLinkedin(account: AccountRow, input: PublishInput): Promise<PublishOutput> {
  const token = await accessToken(account);
  const author = account.external_id;
  if (input.media.some((m) => m.kind === "video")) throw new Error("Videos für LinkedIn sind noch nicht angebunden");
  const images: string[] = [];
  for (const m of input.media.slice(0, 20)) images.push(await uploadImage(token, author, m.url));

  const body: Record<string, unknown> = {
    author,
    // LinkedIn wertet ( ) [ ] { } < > @ | ~ _ * als Formatierung aus
    commentary: input.caption.replace(/([()[\]{}<>@|~_*\\])/g, "\\$1"),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (images.length === 1) body.content = { media: { id: images[0] } };
  if (images.length > 1) body.content = { multiImage: { images: images.map((id) => ({ id })) } };

  const response = await fetch(`${REST}/posts`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await readJson(response, "LinkedIn");
  const id = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id") ?? "";
  return { remote_id: id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
}

// ---------- Profil lesen (Cockpit-Kachel) ----------

const getJson = async <T>(token: string, path: string, extra: Record<string, string> = {}) =>
  readJson<T>(await fetch(`${REST}${path}`, { headers: { ...headers(token), ...extra } }), "LinkedIn");

/** Download-Adresse zu einer Bild- oder Video-URN (Vorschaubild); sonst null */
async function mediaUrl(token: string, urn: string | undefined): Promise<string | null> {
  if (!urn) return null;
  try {
    if (urn.startsWith("urn:li:video:")) return (await getJson<{ thumbnail?: string }>(token, `/videos/${encodeURIComponent(urn)}`)).thumbnail ?? null;
    const image = urn.replace("urn:li:digitalmediaAsset:", "urn:li:image:");
    if (!image.startsWith("urn:li:image:")) return null;
    return (await getJson<{ downloadUrl?: string }>(token, `/images/${encodeURIComponent(image)}`)).downloadUrl ?? null;
  } catch {
    return null;
  }
}

/** LinkedIn-Formatierung in lesbaren Text: Hashtags, Erwähnungen, Escapes */
const plainCommentary = (text: string) =>
  text
    .replace(/\{hashtag\|\\?#\|([^}]+)\}/g, "#$1")
    .replace(/@\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\\([()[\]{}<>@|~_*\\#])/g, "$1");

type LinkedinPost = {
  id: string;
  commentary?: string;
  publishedAt?: number;
  createdAt?: number;
  content?: {
    media?: { id?: string };
    multiImage?: { images?: { id?: string }[] };
    article?: { thumbnail?: string; title?: string };
  };
};

/** Unternehmensseite: Name, Logo, Follower und die letzten 12 Posts
 * (r_organization_social, rw_organization_admin) */
export async function readLinkedin(account: AccountRow): Promise<ProfileRead> {
  const token = await accessToken(account);
  const orgUrn = account.external_id;
  const orgId = orgUrn.split(":").pop()!;
  const vanity = account.handle?.split("/").pop() ?? null;
  const profile: ChannelProfile = { name: account.name, handle: vanity, avatar: account.avatar_url, url: vanity ? `https://www.linkedin.com/company/${vanity}/` : null };
  const errors: string[] = [];
  try {
    const org = await getJson<{ localizedName?: string; vanityName?: string; localizedDescription?: string; logoV2?: { original?: string; cropped?: string } }>(token, `/organizations/${orgId}`);
    Object.assign(profile, {
      name: org.localizedName ?? profile.name,
      handle: org.vanityName ?? profile.handle,
      avatar: (await mediaUrl(token, org.logoV2?.cropped ?? org.logoV2?.original)) ?? profile.avatar,
      bio: org.localizedDescription || undefined,
      url: org.vanityName ? `https://www.linkedin.com/company/${org.vanityName}/` : profile.url,
    });
  } catch (error) {
    errors.push(`Seite: ${error instanceof Error ? error.message : "Fehler"}`);
  }
  try {
    const size = await getJson<{ firstDegreeSize?: number }>(token, `/networkSizes/${encodeURIComponent(orgUrn)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`);
    profile.followers = size.firstDegreeSize;
  } catch {
    // Follower sind optional
  }
  let posts: ProfilePost[] = [];
  try {
    const feed = await getJson<{ elements?: LinkedinPost[] }>(token, `/posts?author=${encodeURIComponent(orgUrn)}&q=author&count=12&sortBy=LAST_MODIFIED`, { "X-RestLi-Method": "FINDER" });
    posts = await Promise.all(
      (feed.elements ?? []).map(async (p) => {
        const content = p.content ?? {};
        const urn = content.media?.id ?? content.multiImage?.images?.[0]?.id ?? content.article?.thumbnail;
        const time = p.publishedAt ?? p.createdAt;
        return {
          id: p.id,
          image: await mediaUrl(token, urn),
          caption: plainCommentary(p.commentary ?? content.article?.title ?? ""),
          url: `https://www.linkedin.com/feed/update/${p.id}`,
          date: time ? new Date(time).toISOString() : null,
          type: content.media?.id?.startsWith("urn:li:video:") ? "video" : content.multiImage ? "carousel" : urn ? "image" : "text",
        } satisfies ProfilePost;
      })
    );
  } catch (error) {
    errors.push(`Posts: ${error instanceof Error ? error.message : "Fehler"}`);
  }
  return { profile, posts, error: errors.length ? errors.join(" · ") : undefined };
}
