import "server-only";
import { callbackUrl, expiresSoon, inSeconds, readJson } from "./oauth";
import type { PublishInput, PublishOutput } from "./meta";
import { accountRefreshToken, accountToken, listAccounts, markAccountError, saveAccount, updateTokens, type AccountRow } from "./store";

// LinkedIn Community Management API: Posts, Kommentare und Antworten auf
// Unternehmensseiten und im persönlichen Profil des verbindenden Kontos
// (w_member_social gehört zum selben Produkt). Braucht
// eine eigene LinkedIn-App, in der nur das Produkt „Community Management
// API“ freigeschaltet ist (LinkedIn verlangt das so); deshalb eigene Keys
// LINKEDIN_CM_CLIENT_ID/SECRET neben der Lead-Sync-App.
// https://learn.microsoft.com/linkedin/marketing/community-management/

const SCOPES = "r_organization_social w_organization_social rw_organization_admin w_member_social";
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

export const headers = (token: string) => ({
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

/** Name aus der Anmeldung: LinkedIn liefert ohne Profil-Scope keine Namen,
 * darum aus der E-Mail der Person, die verbindet (vorname.nachname@…) */
function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  return parts.length ? parts.map((p) => p[0].toUpperCase() + p.slice(1)).join(" ") : "Persönliches Profil";
}

/** Personen-URN des Kontos: aus den Seitenrollen, sonst über /v2/userinfo */
async function memberUrn(token: string, acls: { roleAssignee?: string }[]) {
  const fromAcl = acls.find((a) => a.roleAssignee?.startsWith("urn:li:person:"))?.roleAssignee;
  if (fromAcl) return fromAcl;
  const info = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } });
  if (info.ok) {
    const { sub } = (await info.json()) as { sub?: string };
    if (sub) return `urn:li:person:${sub}`;
  }
  return null;
}

/** Rückkehr vom Login: alle Unternehmensseiten speichern, auf denen das Konto
 * Admin ist, und das persönliche Profil (Posten und Kommentieren als Person) */
export async function finishLinkedin(code: string, origin: string, workspaceId: string, by: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: callbackUrl("linkedin", origin) });
  const acls = await readJson<{ elements: { organization: string; role: string; state: string; roleAssignee?: string }[] }>(
    await fetch(`${REST}/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=100`, { headers: headers(tokens.access_token) }),
    "LinkedIn"
  );
  const common = {
    workspace_id: workspaceId,
    provider: "linkedin" as const,
    token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: inSeconds(tokens.expires_in),
    refresh_expires_at: inSeconds(tokens.refresh_token_expires_in),
    connected_by: by,
  };
  // Einstellungen wie der Autopilot bleiben beim erneuten Verbinden erhalten
  const existing = await listAccounts(workspaceId);
  const keepMeta = (externalId: string, meta: Record<string, unknown>) => ({
    ...(existing.find((a) => a.provider === "linkedin" && a.external_id === externalId)?.meta ?? {}),
    ...meta,
  });
  const saved: AccountRow[] = [];
  for (const acl of acls.elements) {
    const id = acl.organization.split(":").pop()!;
    const org = await readJson<{ localizedName?: string; vanityName?: string }>(
      await fetch(`${REST}/organizations/${id}`, { headers: headers(tokens.access_token) }),
      "LinkedIn"
    ).catch(() => ({ localizedName: undefined, vanityName: undefined }));
    saved.push(
      await saveAccount({
        ...common,
        external_id: acl.organization,
        name: org.localizedName ?? `Unternehmensseite ${id}`,
        handle: org.vanityName ? `linkedin.com/company/${org.vanityName}` : null,
        meta: keepMeta(acl.organization, { kind: "organization" }),
      })
    );
  }
  const person = await memberUrn(tokens.access_token, acls.elements);
  if (person) {
    saved.push(
      await saveAccount({
        ...common,
        external_id: person,
        name: nameFromEmail(by),
        handle: "Persönliches Profil",
        meta: keepMeta(person, { kind: "member" }),
      })
    );
  }
  if (!saved.length) throw new Error("LinkedIn hat weder ein Profil noch eine Unternehmensseite freigegeben");
  return saved;
}

export async function accessToken(account: AccountRow) {
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

// ---------- Community Management: Posts lesen, Kommentare lesen und schreiben ----------

/** Ist das Konto eine Unternehmensseite (Kommentare lesbar) oder eine Person? */
export const linkedinKind = (account: Pick<AccountRow, "external_id">) =>
  account.external_id.startsWith("urn:li:organization:") ? "organization" : "member";

const enc = encodeURIComponent;

export type LinkedinPost = { id: string; commentary?: string; createdAt?: number };

/** Letzte Posts einer Unternehmensseite (r_organization_social) */
export async function recentOrgPosts(account: AccountRow, count = 10) {
  const token = await accessToken(account);
  const data = await readJson<{ elements: LinkedinPost[] }>(
    await fetch(`${REST}/posts?author=${enc(account.external_id)}&q=author&count=${count}&sortBy=LAST_MODIFIED`, {
      headers: { ...headers(token), "X-RestLi-Method": "FINDER" },
    }),
    "LinkedIn"
  );
  return data.elements ?? [];
}

export type LinkedinComment = {
  urn: string;
  object: string;
  actor: string;
  text: string;
  parent: string | null;
  created_at: string | null;
};

type RawComment = {
  $URN?: string;
  commentUrn?: string;
  id?: string;
  object?: string;
  actor?: string;
  message?: { text?: string };
  parentComment?: string;
  created?: { time?: number };
};

/** Kommentare zu einem Post oder Antworten auf einen Kommentar (target) */
export async function listComments(account: AccountRow, target: string, count = 50): Promise<LinkedinComment[]> {
  const token = await accessToken(account);
  const data = await readJson<{ elements?: RawComment[] }>(
    await fetch(`${REST}/socialActions/${enc(target)}/comments?count=${count}`, { headers: headers(token) }),
    "LinkedIn"
  );
  return (data.elements ?? [])
    .map((c) => ({
      urn: c.commentUrn ?? c.$URN ?? "",
      object: c.object ?? target,
      actor: c.actor ?? "",
      text: c.message?.text ?? "",
      parent: c.parentComment ?? null,
      created_at: c.created?.time ? new Date(c.created.time).toISOString() : null,
    }))
    .filter((c) => c.urn && c.actor);
}

/** Kommentar schreiben, als Seite oder Person. target: Post-URN oder (für
 * eine Antwort) Kommentar-URN; object: die Aktivität bzw. der Post. */
export async function createComment(account: AccountRow, input: { target: string; object: string; text: string; parent?: string | null }) {
  const token = await accessToken(account);
  const body: Record<string, unknown> = { actor: account.external_id, object: input.object, message: { text: input.text } };
  if (input.parent) body.parentComment = input.parent;
  const response = await fetch(`${REST}/socialActions/${enc(input.target)}/comments`, {
    method: "POST",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<RawComment | null>(response, "LinkedIn");
  return data?.commentUrn ?? data?.$URN ?? response.headers.get("x-restli-id") ?? "";
}

/** Post-Adresse oder URN → URN, z. B. …/feed/update/urn:li:activity:123 oder
 * …/posts/name_titel-activity-123-abcd → urn:li:activity:123 */
export function postUrn(input: string) {
  const value = decodeURIComponent(input.trim());
  const urn = value.match(/urn:li:(activity|share|ugcPost):\d+/);
  if (urn) return urn[0];
  const activity = value.match(/activity[-:](\d{10,})/);
  return activity ? `urn:li:activity:${activity[1]}` : null;
}
