import "server-only";
import { randomBytes } from "node:crypto";
import { CLIENT_ID, DEMO, TENANT_ID } from "@/lib/config";
import { db } from "./db";
import { decrypt, encrypt } from "./vault";

// Absenderin für Kunden-Updates: ein normales Microsoft-365-Konto mit Teams,
// das einmal im Intranet verbunden wird (Admin → Absender & Updates). Der
// Server bewahrt dessen Refresh-Token verschlüsselt auf (VAULT_KEY) und
// schickt damit Nachrichten in die Kundenchats, genau wie die Person selbst.
// Braucht in Entra eine Web-Redirect-URI …/api/sender/callback und
// MS_CLIENT_SECRET.

const AUTHORITY = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0`;
const SCOPES = "offline_access openid profile User.Read Chat.ReadWrite";
const GRAPH = "https://graph.microsoft.com/v1.0";

type Stored = { email: string; name: string; refresh: string; connected_at: string; connected_by: string };
export type SenderInfo = { email: string; name: string; connected_at: string; connected_by: string } | null;

export const redirectUri = (origin: string) => `${process.env.INTRANET_URL ?? origin}/api/sender/callback`;

function secret() {
  const value = process.env.MS_CLIENT_SECRET;
  if (!value) throw new Error("MS_CLIENT_SECRET fehlt");
  return value;
}

export async function senderInfo(): Promise<SenderInfo> {
  if (DEMO) return { email: "lena@grid-agency.de", name: "Lena Berger", connected_at: new Date().toISOString(), connected_by: "vorschau@grid-agency.de" };
  const stored = await db().getSetting<Stored>("teams_sender");
  if (!stored) return null;
  const { email, name, connected_at, connected_by } = stored;
  return { email, name, connected_at, connected_by };
}

/** Startet die Anmeldung des Absender-Kontos; liefert die Microsoft-URL. */
export async function startConnect(origin: string, by: string, loginHint?: string) {
  secret();
  if (!process.env.VAULT_KEY) throw new Error("Erst VAULT_KEY in Vercel anlegen, damit das Konto verschlüsselt gespeichert werden kann");
  const state = randomBytes(24).toString("base64url");
  await db().setSetting("teams_sender_state", { state, by, expires: Date.now() + 10 * 60_000 });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(origin),
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "select_account",
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `${AUTHORITY}/authorize?${params}`;
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(`${AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: secret(), scope: SCOPES, ...params }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description?.split("\r\n")[0] ?? `Microsoft antwortet mit ${response.status}`);
  return data as { access_token: string; refresh_token?: string; id_token?: string; expires_in: number };
}

/** Rückkehr von Microsoft: Code gegen Tokens tauschen und speichern. */
export async function finishConnect(code: string, state: string, origin: string) {
  // Der Rücksprung von Microsoft hat kein Intranet-Token; wer verbunden hat,
  // steht deshalb im State, den nur ein Admin anlegen konnte
  const expected = await db().getSetting<{ state: string; by: string; expires: number }>("teams_sender_state");
  if (!expected || expected.state !== state || expected.expires < Date.now()) throw new Error("Anmeldung abgelaufen, bitte neu verbinden");
  await db().setSetting("teams_sender_state", false); // value ist NOT NULL
  const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });
  if (!tokens.refresh_token) throw new Error("Microsoft hat kein Refresh-Token geliefert");
  // Das ID-Token kommt direkt vom Token-Endpunkt (TLS); hier nur auslesen
  const claims = JSON.parse(Buffer.from((tokens.id_token ?? "..").split(".")[1] ?? "", "base64url").toString() || "{}");
  if (claims.tid && claims.tid !== TENANT_ID) throw new Error("Nur Konten von GRID");
  const stored: Stored = {
    email: String(claims.preferred_username ?? "").toLowerCase(),
    name: String(claims.name ?? claims.preferred_username ?? "Absender"),
    refresh: encrypt(tokens.refresh_token),
    connected_at: new Date().toISOString(),
    connected_by: expected.by,
  };
  await db().setSetting("teams_sender", stored);
  cached = { token: tokens.access_token, expires: Date.now() + tokens.expires_in * 1000 };
  return stored;
}

export async function disconnect() {
  cached = null;
  await db().setSetting("teams_sender", false); // value ist NOT NULL
}

let cached: { token: string; expires: number } | null = null;

async function accessToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const stored = await db().getSetting<Stored>("teams_sender");
  if (!stored) throw new Error("Kein Absender-Konto verbunden");
  const tokens = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(stored.refresh) });
  // Microsoft rollt Refresh-Tokens; das neue sofort sichern
  if (tokens.refresh_token) await db().setSetting("teams_sender", { ...stored, refresh: encrypt(tokens.refresh_token) });
  cached = { token: tokens.access_token, expires: Date.now() + tokens.expires_in * 1000 };
  return cached.token;
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Teams antwortet mit ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export type SenderChat = { id: string; title: string; chatType: string; members: string[]; lastAt: string | null };

/** Chats des Absender-Kontos (zum Zuordnen der Kunden) */
export async function senderChats(): Promise<SenderChat[]> {
  if (DEMO) {
    return [
      { id: "demo-chat-2", title: "Huck Content", chatType: "group", members: ["Tanja Huck", "Jacob Huck"], lastAt: new Date().toISOString() },
      { id: "demo-chat-9", title: "480 GRADI × GRID", chatType: "group", members: ["Daniel"], lastAt: null },
    ];
  }
  const me = await senderInfo();
  const data = await graph<{
    value: { id: string; topic: string | null; chatType: string; members?: { displayName: string | null; email?: string | null }[]; lastMessagePreview?: { createdDateTime: string } | null }[];
  }>("/me/chats?$expand=members,lastMessagePreview&$orderby=lastMessagePreview/createdDateTime desc&$top=50");
  return data.value.map((chat) => {
    const others = (chat.members ?? []).filter((m) => m.email?.toLowerCase() !== me?.email);
    const names = others.map((m) => m.displayName ?? m.email ?? "").filter(Boolean);
    return { id: chat.id, title: chat.topic || names.join(", ") || "Chat", chatType: chat.chatType, members: names, lastAt: chat.lastMessagePreview?.createdDateTime ?? null };
  });
}

export type SenderMessage = { id: string; at: string; from: string | null; text: string; mine: boolean };

/** Letzte Nachrichten eines Kundenchats, z. B. um Antworten zu sehen */
export async function senderMessages(chatId: string): Promise<SenderMessage[]> {
  if (DEMO) return [{ id: "1", at: new Date().toISOString(), from: "Tanja Huck", text: "Danke für das Update! 👍", mine: false }];
  const me = await senderInfo();
  const data = await graph<{ value: { id: string; createdDateTime: string; messageType: string; from?: { user?: { displayName?: string } } | null; body: { content: string } }[] }>(
    `/chats/${encodeURIComponent(chatId)}/messages?$top=30&$orderby=createdDateTime desc`
  );
  return data.value
    .filter((m) => m.messageType === "message")
    .map((m) => ({
      id: m.id,
      at: m.createdDateTime,
      from: m.from?.user?.displayName ?? null,
      text: m.body.content.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim(),
      mine: m.from?.user?.displayName === me?.name,
    }))
    .reverse();
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Nachricht als Absender-Konto in einen Chat schicken */
export async function sendAsSender(chatId: string, text: string) {
  if (DEMO) return;
  await graph(`/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: { contentType: "html", content: escapeHtml(text).replace(/\n/g, "<br>") } }),
  });
}
