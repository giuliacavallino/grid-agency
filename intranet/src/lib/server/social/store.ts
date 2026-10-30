import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DEMO } from "@/lib/config";
import type { MediaItem, PostResult, Provider, SocialAccount, SocialPost, Workspace } from "@/lib/marketing";
import { sb } from "../db";
import { decrypt, encrypt } from "../vault";
import { publicMediaUrl } from "./media";

// Daten des Marketing Hubs (Supabase, in der Vorschau im Speicher).
// Tokens werden beim Speichern verschlüsselt und nur hier entschlüsselt.

export type AccountRow = SocialAccount & {
  token: string | null;
  refresh_token: string | null;
  refresh_expires_at: string | null;
  meta: Record<string, unknown>;
};

const demo = {
  workspaces: [
    { id: "demo-ws-grid", name: "GRID AGENCY", kind: "agency", color: "#141414", project_id: null, customer_id: null, archived: false, settings: {} },
    { id: "demo-ws-1", name: "Bäckerei Sonne", kind: "customer", color: "#f5a524", secondary_color: "#7a3e00", project_id: "demo-tp-1", customer_id: null, archived: false, settings: {} },
    { id: "demo-ws-2", name: "Pizzeria Forno", kind: "customer", color: "#e5484d", project_id: "demo-tp-2", customer_id: null, archived: false, settings: {} },
  ] as WorkspaceRow[],
  accounts: [] as AccountRow[],
  posts: [] as SocialPost[],
  states: new Map<string, StateValue & { expires_at: number }>(),
  links: [] as { id: string; workspace_id: string; token_hash: string; created_by: string; expires_at: string; revoked: boolean }[],
};

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

/** Konto ohne Tokens, für den Browser und den Agenten */
export const publicAccount = (a: AccountRow): SocialAccount => ({
  id: a.id,
  workspace_id: a.workspace_id,
  provider: a.provider,
  external_id: a.external_id,
  name: a.name,
  handle: a.handle,
  avatar_url: a.avatar_url,
  expires_at: a.expires_at,
  status: a.status,
  error: a.error,
  connected_by: a.connected_by,
  connected_at: a.connected_at,
});

// ---------- Kundenwelten ----------

type WorkspaceRow = Omit<Workspace, "logo_url" | "sharepoint_url" | "secondary_color"> & {
  secondary_color?: string | null;
  logo_path?: string | null;
  settings: Record<string, unknown>;
};

const toWorkspace = ({ logo_path, settings, secondary_color, ...rest }: WorkspaceRow): Workspace => ({
  ...rest,
  secondary_color: secondary_color ?? null,
  logo_url: logo_path ? publicMediaUrl(logo_path) : null,
  sharepoint_url: typeof settings?.sharepoint_url === "string" ? settings.sharepoint_url : null,
});

const COLUMNS = "id, name, kind, color, secondary_color, logo_path, project_id, customer_id, archived, settings";

export async function listWorkspaces(): Promise<Workspace[]> {
  if (DEMO) return demo.workspaces.map(toWorkspace);
  const rows = check(await sb().from("workspaces").select(COLUMNS).eq("archived", false).order("kind").order("name")) as WorkspaceRow[];
  return rows.map(toWorkspace);
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  return (await listWorkspaces()).find((w) => w.id === id) ?? null;
}

export async function agencyWorkspace() {
  const ws = (await listWorkspaces()).find((w) => w.kind === "agency");
  if (!ws) throw new Error("Kundenwelt von GRID fehlt");
  return ws;
}

export type BrandInput = { name?: string; color?: string; secondary_color?: string | null; logo_path?: string | null };

const HEX = /^#[0-9a-f]{6}$/i;

/** Nur gültige Werte übernehmen (Farben als #rrggbb, Logo als Storage-Pfad) */
function brand(input: BrandInput) {
  const row: Record<string, unknown> = {};
  if (input.name?.trim()) row.name = input.name.trim().slice(0, 120);
  if (input.color && HEX.test(input.color)) row.color = input.color.toLowerCase();
  if (input.secondary_color === null || (input.secondary_color && HEX.test(input.secondary_color))) row.secondary_color = input.secondary_color?.toLowerCase() ?? null;
  if (input.logo_path === null || (input.logo_path && /^[0-9a-f-]{36}\/[a-z0-9-_]+\.(png|jpg|webp)$/i.test(input.logo_path))) row.logo_path = input.logo_path;
  return row;
}

export async function createWorkspace(input: BrandInput & { project_id?: string | null }): Promise<Workspace> {
  const row = { color: "#afaaa0", ...brand(input), kind: "customer" as const, project_id: input.project_id ?? null };
  if (DEMO) {
    const ws = { id: `demo-ws-${randomUUID().slice(0, 8)}`, customer_id: null, archived: false, settings: {}, ...row } as WorkspaceRow;
    demo.workspaces.push(ws);
    return toWorkspace(ws);
  }
  return toWorkspace(check(await sb().from("workspaces").insert(row).select(COLUMNS).single()) as WorkspaceRow);
}

/** CI der Kundenwelt ändern */
export async function updateWorkspace(id: string, input: BrandInput): Promise<Workspace> {
  const patch = brand(input);
  if (DEMO) {
    const ws = demo.workspaces.find((w) => w.id === id);
    if (!ws) throw new Error("Kundenwelt nicht gefunden");
    return toWorkspace(Object.assign(ws, patch));
  }
  return toWorkspace(check(await sb().from("workspaces").update(patch).eq("id", id).select(COLUMNS).single()) as WorkspaceRow);
}

export async function workspaceSettings(id: string): Promise<Record<string, unknown>> {
  if (DEMO) return demo.workspaces.find((w) => w.id === id)?.settings ?? {};
  const row = check(await sb().from("workspaces").select("settings").eq("id", id).maybeSingle()) as { settings: Record<string, unknown> } | null;
  return row?.settings ?? {};
}

export async function updateWorkspaceSettings(id: string, patch: Record<string, unknown>) {
  if (DEMO) return void Object.assign(demo.workspaces.find((w) => w.id === id)?.settings ?? {}, patch);
  const settings = { ...(await workspaceSettings(id)), ...patch };
  check(await sb().from("workspaces").update({ settings }).eq("id", id));
}

// ---------- Konten ----------

export async function listAccounts(workspaceId?: string): Promise<AccountRow[]> {
  if (DEMO) return demo.accounts.filter((a) => !workspaceId || a.workspace_id === workspaceId);
  let query = sb().from("social_accounts").select("*").order("provider").order("name");
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  return check(await query) as AccountRow[];
}

export async function getAccount(id: string): Promise<AccountRow | null> {
  if (DEMO) return demo.accounts.find((a) => a.id === id) ?? null;
  return check(await sb().from("social_accounts").select("*").eq("id", id).maybeSingle()) as AccountRow | null;
}

export type AccountInput = {
  workspace_id: string;
  provider: Provider;
  external_id: string;
  name: string;
  handle?: string | null;
  avatar_url?: string | null;
  token?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  refresh_expires_at?: string | null;
  meta?: Record<string, unknown>;
  connected_by: string;
};

/** Anlegen oder (gleiches Konto erneut verbunden) aktualisieren */
export async function saveAccount(input: AccountInput): Promise<AccountRow> {
  const row = {
    ...input,
    token: input.token ? encrypt(input.token) : null,
    refresh_token: input.refresh_token ? encrypt(input.refresh_token) : null,
    meta: input.meta ?? {},
    status: "active" as const,
    error: null,
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (DEMO) {
    const existing = demo.accounts.find((a) => a.workspace_id === row.workspace_id && a.provider === row.provider && a.external_id === row.external_id);
    const saved = { id: existing?.id ?? randomUUID(), handle: null, avatar_url: null, expires_at: null, refresh_expires_at: null, ...existing, ...row } as AccountRow;
    if (existing) Object.assign(existing, saved);
    else demo.accounts.push(saved);
    return saved;
  }
  return check(
    await sb().from("social_accounts").upsert(row, { onConflict: "workspace_id,provider,external_id" }).select("*").single()
  ) as AccountRow;
}

/** Neue Tokens nach einem Refresh speichern */
export async function updateTokens(id: string, tokens: { token: string; refresh_token?: string | null; expires_at?: string | null; refresh_expires_at?: string | null }) {
  const patch: Record<string, unknown> = { token: encrypt(tokens.token), status: "active", error: null, updated_at: new Date().toISOString() };
  if (tokens.refresh_token) patch.refresh_token = encrypt(tokens.refresh_token);
  if (tokens.expires_at !== undefined) patch.expires_at = tokens.expires_at;
  if (tokens.refresh_expires_at !== undefined) patch.refresh_expires_at = tokens.refresh_expires_at;
  if (DEMO) return void Object.assign(demo.accounts.find((a) => a.id === id) ?? {}, patch);
  check(await sb().from("social_accounts").update(patch).eq("id", id));
}

export async function markAccountError(id: string, error: string) {
  const patch = { status: "error", error: error.slice(0, 500), updated_at: new Date().toISOString() };
  if (DEMO) return void Object.assign(demo.accounts.find((a) => a.id === id) ?? {}, patch);
  check(await sb().from("social_accounts").update(patch).eq("id", id));
}

export async function deleteAccount(id: string) {
  if (DEMO) return void demo.accounts.splice(demo.accounts.findIndex((a) => a.id === id), 1);
  check(await sb().from("social_accounts").delete().eq("id", id));
}

export const accountToken = (account: AccountRow) => (account.token ? decrypt(account.token) : null);
export const accountRefreshToken = (account: AccountRow) => (account.refresh_token ? decrypt(account.refresh_token) : null);

// ---------- OAuth-State ----------

type StateValue = { provider: string; workspace_id: string | null; verifier: string | null; created_by: string; return_path: string | null };

export async function saveState(state: string, value: StateValue) {
  const expires_at = Date.now() + 15 * 60_000;
  if (DEMO) return void demo.states.set(state, { ...value, expires_at });
  check(await sb().from("oauth_states").insert({ state, ...value, expires_at: new Date(expires_at).toISOString() }));
}

/** State einmalig einlösen; abgelaufene oder fremde States gelten nicht */
export async function takeState(state: string, provider: string) {
  if (DEMO) {
    const value = demo.states.get(state);
    demo.states.delete(state);
    return value && value.provider === provider && value.expires_at > Date.now() ? value : null;
  }
  const row = check(await sb().from("oauth_states").delete().eq("state", state).select("*").maybeSingle()) as (StateValue & { expires_at: string }) | null;
  if (!row || row.provider !== provider || new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

// ---------- Verbindungslinks für Kunden ----------

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Neuen Link für eine Kundenwelt; der Klartext-Token existiert nur in der Antwort */
export async function createConnectLink(workspaceId: string, by: string, days = 14) {
  const token = randomBytes(24).toString("base64url");
  const row = { workspace_id: workspaceId, token_hash: hashToken(token), created_by: by, expires_at: new Date(Date.now() + days * 86_400_000).toISOString() };
  if (DEMO) demo.links.push({ id: randomUUID(), revoked: false, ...row });
  else check(await sb().from("connect_links").insert(row));
  return { token, expires_at: row.expires_at };
}

/** Kundenwelt zu einem gültigen Link, sonst null */
export async function resolveConnectLink(token: string): Promise<Workspace | null> {
  if (!token || token.length < 20) return null;
  const hash = hashToken(token);
  const link = DEMO
    ? demo.links.find((l) => l.token_hash === hash) ?? null
    : (check(await sb().from("connect_links").select("workspace_id, expires_at, revoked").eq("token_hash", hash).maybeSingle()) as { workspace_id: string; expires_at: string; revoked: boolean } | null);
  if (!link || link.revoked || new Date(link.expires_at).getTime() < Date.now()) return null;
  if (!DEMO) await sb().from("connect_links").update({ last_used_at: new Date().toISOString() }).eq("token_hash", hash);
  return getWorkspace(link.workspace_id);
}

/** Alle Links einer Kundenwelt sperren (z. B. nach dem Verbinden) */
export async function revokeConnectLinks(workspaceId: string) {
  if (DEMO) return void demo.links.filter((l) => l.workspace_id === workspaceId).forEach((l) => (l.revoked = true));
  check(await sb().from("connect_links").update({ revoked: true }).eq("workspace_id", workspaceId));
}

// ---------- Posts ----------

export async function listPosts(filter: { workspace_id?: string; status?: string; limit?: number } = {}): Promise<SocialPost[]> {
  if (DEMO) {
    return demo.posts
      .filter((p) => (!filter.workspace_id || p.workspace_id === filter.workspace_id) && (!filter.status || p.status === filter.status))
      .sort((a, b) => (b.scheduled_at ?? b.created_at).localeCompare(a.scheduled_at ?? a.created_at))
      .slice(0, filter.limit ?? 100);
  }
  let query = sb().from("social_posts").select("*").order("created_at", { ascending: false }).limit(filter.limit ?? 100);
  if (filter.workspace_id) query = query.eq("workspace_id", filter.workspace_id);
  if (filter.status) query = query.eq("status", filter.status);
  return check(await query) as SocialPost[];
}

export async function getPost(id: string): Promise<SocialPost | null> {
  if (DEMO) return demo.posts.find((p) => p.id === id) ?? null;
  return check(await sb().from("social_posts").select("*").eq("id", id).maybeSingle()) as SocialPost | null;
}

export type PostInput = {
  workspace_id: string;
  caption?: string;
  media?: MediaItem[];
  account_ids?: string[];
  scheduled_at?: string | null;
  status?: "draft" | "scheduled";
  created_by: string;
};

export async function insertPost(input: PostInput): Promise<SocialPost> {
  const row = {
    workspace_id: input.workspace_id,
    caption: input.caption ?? "",
    media: input.media ?? [],
    account_ids: input.account_ids ?? [],
    scheduled_at: input.scheduled_at ?? null,
    status: input.status ?? "draft",
    created_by: input.created_by,
  };
  if (DEMO) {
    const now = new Date().toISOString();
    const post: SocialPost = { id: randomUUID(), created_at: now, updated_at: now, published_at: null, results: {}, ...row };
    demo.posts.push(post);
    return post;
  }
  return check(await sb().from("social_posts").insert(row).select("*").single()) as SocialPost;
}

export async function updatePost(id: string, patch: Partial<Omit<SocialPost, "id" | "created_at">>): Promise<SocialPost> {
  const next = { ...patch, updated_at: new Date().toISOString() };
  if (DEMO) {
    const post = demo.posts.find((p) => p.id === id);
    if (!post) throw new Error("Post nicht gefunden");
    return Object.assign(post, next);
  }
  return check(await sb().from("social_posts").update(next).eq("id", id).select("*").single()) as SocialPost;
}

/** Status nur wechseln, wenn er noch der erwartete ist (kein doppeltes Posten) */
export async function claimPost(id: string, from: SocialPost["status"][]): Promise<SocialPost | null> {
  if (DEMO) {
    const post = demo.posts.find((p) => p.id === id && from.includes(p.status));
    if (!post) return null;
    post.status = "publishing";
    return post;
  }
  const rows = check(
    await sb().from("social_posts").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", id).in("status", from).select("*")
  ) as SocialPost[];
  return rows[0] ?? null;
}

export async function deletePost(id: string) {
  if (DEMO) return void demo.posts.splice(demo.posts.findIndex((p) => p.id === id), 1);
  check(await sb().from("social_posts").delete().eq("id", id));
}

/** Posts, die beim Veröffentlichen hängen geblieben sind (Abbruch nach
 * Zeitlimit), wieder freigeben; erledigte Kanäle bleiben erledigt */
export async function releaseStuck(now: Date) {
  const before = new Date(now.getTime() - 15 * 60_000).toISOString();
  if (DEMO) return;
  check(await sb().from("social_posts").update({ status: "failed" }).eq("status", "publishing").lt("updated_at", before));
}

export async function duePosts(now: Date): Promise<SocialPost[]> {
  if (DEMO) return demo.posts.filter((p) => p.status === "scheduled" && p.scheduled_at && p.scheduled_at <= now.toISOString());
  return check(
    await sb().from("social_posts").select("*").eq("status", "scheduled").lte("scheduled_at", now.toISOString()).order("scheduled_at").limit(50)
  ) as SocialPost[];
}

export const resultEntry = (result: Omit<PostResult, "at">): PostResult => ({ ...result, at: new Date().toISOString() });
