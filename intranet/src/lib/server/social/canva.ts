import "server-only";
import { DEMO } from "@/lib/config";
import type { MediaItem } from "@/lib/marketing";
import { storeFromUrl } from "./media";
import { callbackUrl, expiresSoon, inSeconds, readJson } from "./oauth";
import {
  accountRefreshToken,
  accountToken,
  agencyWorkspace,
  getWorkspace,
  listAccounts,
  markAccountError,
  saveAccount,
  updateTokens,
  updateWorkspaceSettings,
  workspaceSettings,
  type AccountRow,
} from "./store";

// Canva Connect API (Canva Pro/Teams): Designs anlegen, Assets hochladen,
// Designs exportieren. Ein Canva-Konto für ganz GRID (gehört zur Kundenwelt
// von GRID); jede Kundenwelt bekommt in Canva einen eigenen Ordner.
// Vorlagen automatisch befüllen (Autofill) ginge nur mit Canva Enterprise.
// https://www.canva.dev/docs/connect/

const API = "https://api.canva.com/rest/v1";
const SCOPES = "design:content:read design:content:write design:meta:read asset:read asset:write folder:read folder:write profile:read";

export const canvaConfigured = () => DEMO || (!!process.env.CANVA_CLIENT_ID && !!process.env.CANVA_CLIENT_SECRET);

const basic = () => `Basic ${Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString("base64")}`;

export function canvaAuthorizeUrl(origin: string, state: string, challenge: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.CANVA_CLIENT_ID ?? "",
    redirect_uri: callbackUrl("canva", origin),
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "s256",
  });
  return `https://www.canva.com/api/oauth/authorize?${params}`;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return readJson<TokenResponse>(response, "Canva");
}

export async function finishCanva(code: string, verifier: string, origin: string, by: string) {
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: callbackUrl("canva", origin) });
  const headers = { Authorization: `Bearer ${tokens.access_token}` };
  const me = await readJson<{ team_user: { user_id: string; team_id: string } }>(await fetch(`${API}/users/me`, { headers }), "Canva");
  const profile = await readJson<{ profile: { display_name?: string } }>(await fetch(`${API}/users/me/profile`, { headers }), "Canva").catch(() => ({ profile: {} as { display_name?: string } }));
  const ws = await agencyWorkspace();
  return saveAccount({
    workspace_id: ws.id,
    provider: "canva",
    external_id: me.team_user.user_id,
    name: profile.profile.display_name || "Canva",
    token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: inSeconds(tokens.expires_in),
    meta: { team_id: me.team_user.team_id },
    connected_by: by,
  });
}

/** Das (eine) Canva-Konto von GRID */
export async function canvaAccount(): Promise<AccountRow | null> {
  const ws = await agencyWorkspace();
  return (await listAccounts(ws.id)).find((a) => a.provider === "canva") ?? null;
}

async function accessToken(account: AccountRow) {
  if (!expiresSoon(account.expires_at)) return accountToken(account)!;
  const refresh = accountRefreshToken(account);
  if (!refresh) throw new Error("Canva neu verbinden");
  try {
    // Canva gibt jedes Mal ein neues Refresh-Token aus; das alte gilt dann nicht mehr
    const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
    await updateTokens(account.id, { token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: inSeconds(tokens.expires_in) });
    return tokens.access_token;
  } catch (error) {
    await markAccountError(account.id, "Canva-Verbindung abgelaufen, bitte neu verbinden");
    throw error;
  }
}

async function canva<T>(path: string, init: RequestInit = {}): Promise<T> {
  const account = await canvaAccount();
  if (!account) throw new Error("Canva ist noch nicht verbunden");
  const token = await accessToken(account);
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  return readJson<T>(response, "Canva");
}

/** Auf einen Canva-Job warten (Export, Upload) */
async function poll<T extends { status: string }>(path: string, pick: (data: unknown) => T, timeoutMs = 60_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (let wait = 800; ; wait = Math.min(wait * 1.5, 4000)) {
    const job = pick(await canva<unknown>(path));
    if (job.status !== "in_progress") return job;
    if (Date.now() > until) throw new Error("Canva braucht zu lange, bitte später erneut versuchen");
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

export type CanvaDesign = { id: string; title: string; thumbnail: string | null; edit_url: string | null; view_url: string | null; updated_at: number | null; page_count: number | null };

type RawDesign = { id: string; title?: string; thumbnail?: { url: string }; urls?: { edit_url?: string; view_url?: string }; updated_at?: number; page_count?: number };

const toDesign = (d: RawDesign): CanvaDesign => ({
  id: d.id,
  title: d.title || "Ohne Titel",
  thumbnail: d.thumbnail?.url ?? null,
  edit_url: d.urls?.edit_url ?? null,
  view_url: d.urls?.view_url ?? null,
  updated_at: d.updated_at ?? null,
  page_count: d.page_count ?? null,
});

export async function listDesigns(query?: string, continuation?: string) {
  if (DEMO) return { items: [{ id: "demo-design-1", title: "Herbst-Reel Bäckerei", thumbnail: null, edit_url: null, view_url: null, updated_at: Date.now() / 1000, page_count: 1 }], continuation: null };
  const params = new URLSearchParams({ ownership: "any", sort_by: "modified_descending" });
  if (query) params.set("query", query);
  if (continuation) params.set("continuation", continuation);
  const data = await canva<{ items: RawDesign[]; continuation?: string }>(`/designs?${params}`);
  return { items: data.items.map(toDesign), continuation: data.continuation ?? null };
}

/** Ordner der Kundenwelt in Canva (wird beim ersten Mal angelegt) */
async function workspaceFolder(workspaceId: string) {
  const settings = await workspaceSettings(workspaceId);
  if (typeof settings.canva_folder_id === "string") return settings.canva_folder_id;
  const ws = await getWorkspace(workspaceId);
  const { folder } = await canva<{ folder: { id: string } }>("/folders", {
    method: "POST",
    body: JSON.stringify({ name: `GRID · ${ws?.name ?? "Kunde"}`.slice(0, 255), parent_folder_id: "root" }),
  });
  await updateWorkspaceSettings(workspaceId, { canva_folder_id: folder.id });
  return folder.id;
}

/** Neues Design anlegen, z. B. 1080 × 1350 für einen Instagram-Post */
export async function createDesign(input: { title: string; width?: number; height?: number; asset_id?: string; workspace_id?: string }) {
  if (DEMO) return { id: `demo-design-${Date.now()}`, title: input.title, thumbnail: null, edit_url: null, view_url: null, updated_at: Date.now() / 1000, page_count: 1 };
  const width = Math.min(Math.max(Math.round(input.width ?? 1080), 40), 8000);
  const height = Math.min(Math.max(Math.round(input.height ?? 1350), 40), 8000);
  const { design } = await canva<{ design: RawDesign }>("/designs", {
    method: "POST",
    body: JSON.stringify({ design_type: { type: "custom", width, height }, title: input.title.slice(0, 255), ...(input.asset_id ? { asset_id: input.asset_id } : {}) }),
  });
  if (input.workspace_id) {
    // Einsortieren ist nur Ordnung; scheitert es, bleibt das Design in „Projekte“
    try {
      const folder = await workspaceFolder(input.workspace_id);
      await canva("/folders/move", { method: "POST", body: JSON.stringify({ item_id: design.id, from_folder_id: "root", to_folder_id: folder }) });
    } catch (error) {
      console.error("Canva-Ordner", error);
    }
  }
  return toDesign(design);
}

/** Bild oder Video als Asset nach Canva hochladen (z. B. Produktfotos) */
export async function uploadAsset(bytes: Uint8Array, name: string) {
  if (DEMO) return { id: `demo-asset-${Date.now()}`, name };
  const meta = JSON.stringify({ name_base64: Buffer.from(name.slice(0, 50)).toString("base64") });
  const { job } = await canva<{ job: { id: string; status: string } }>("/asset-uploads", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "Asset-Upload-Metadata": meta },
    body: Buffer.from(bytes),
  });
  const done = await poll(`/asset-uploads/${job.id}`, (data) => (data as { job: { status: string; asset?: { id: string; name: string }; error?: { message: string } } }).job);
  if (done.status !== "success" || !("asset" in done) || !done.asset) throw new Error(`Canva-Upload fehlgeschlagen: ${"error" in done ? done.error?.message : "unbekannt"}`);
  return done.asset;
}

export type ExportFormat = "png" | "jpg" | "mp4" | "pdf";

/** Design exportieren und die Dateien im Intranet ablegen (für Posts) */
export async function exportDesign(designId: string, format: ExportFormat = "png", options: { pages?: number[]; vertical?: boolean } = {}): Promise<MediaItem[]> {
  if (DEMO) return [];
  const formatBody: Record<string, unknown> = { type: format };
  if (format === "jpg") formatBody.quality = 95;
  if (format === "mp4") formatBody.quality = options.vertical === false ? "horizontal_1080p" : "vertical_1080p";
  if (options.pages?.length) formatBody.pages = options.pages;
  const { job } = await canva<{ job: { id: string } }>("/exports", { method: "POST", body: JSON.stringify({ design_id: designId, format: formatBody }) });
  const done = await poll(`/exports/${job.id}`, (data) => (data as { job: { status: string; urls?: string[]; error?: { message: string } } }).job, 120_000);
  if (done.status !== "success" || !("urls" in done) || !done.urls?.length) {
    throw new Error(`Canva-Export fehlgeschlagen: ${"error" in done ? done.error?.message : "unbekannt"}`);
  }
  const media: MediaItem[] = [];
  for (const [index, url] of done.urls.entries()) {
    media.push(await storeFromUrl(url, `canva-${designId}-${index + 1}`, { canva_design_id: designId }));
  }
  return media;
}
