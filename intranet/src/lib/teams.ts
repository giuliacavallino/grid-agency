"use client";

import { getGraphToken } from "./auth";
import { DEMO } from "./config";

// Microsoft-Teams-Chats über Microsoft Graph, delegiert mit dem Login der
// Person: Nachrichten gehen also wirklich von ihr aus, wie in Teams selbst.

export const TEAMS_SCOPES = ["Chat.ReadWrite"];
const GRAPH = "https://graph.microsoft.com/v1.0";

export type ChatMember = { displayName: string | null; email: string | null; userId: string | null };

export type Chat = {
  id: string;
  topic: string | null;
  chatType: "oneOnOne" | "group" | "meeting" | string;
  members: ChatMember[];
  lastMessage: { text: string; from: string | null; at: string } | null;
  webUrl: string | null;
};

export type ChatMessage = {
  id: string;
  createdDateTime: string;
  from: string | null;
  fromId: string | null;
  text: string;
  system: boolean;
};

export class TeamsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function graph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getGraphToken(TEAMS_SCOPES);
  const response = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new TeamsError(response.status, body?.error?.message ?? `Teams antwortet mit ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Teams liefert HTML; angezeigt wird reiner Text (kein fremdes HTML im Intranet). */
export function htmlToText(html: string) {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n"), "text/html");
  doc.querySelectorAll("attachment").forEach((node) => node.replaceWith("📎"));
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Klartext → Teams-HTML: Zeilenumbrüche bleiben, Links werden klickbar. */
export function textToHtml(text: string) {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>");
}

type GraphChat = {
  id: string;
  topic: string | null;
  chatType: string;
  webUrl?: string;
  members?: { displayName: string | null; email?: string | null; userId?: string | null }[];
  lastMessagePreview?: { createdDateTime: string; body?: { content?: string }; from?: { user?: { displayName?: string } } | null } | null;
};

type GraphMessage = {
  id: string;
  createdDateTime: string;
  messageType: string;
  deletedDateTime: string | null;
  from?: { user?: { displayName?: string; id?: string } } | null;
  body: { content: string; contentType: string };
};

const toChat = (c: GraphChat): Chat => ({
  id: c.id,
  topic: c.topic,
  chatType: c.chatType,
  webUrl: c.webUrl ?? null,
  members: (c.members ?? []).map((m) => ({ displayName: m.displayName, email: m.email?.toLowerCase() ?? null, userId: m.userId ?? null })),
  lastMessage: c.lastMessagePreview
    ? {
        text: htmlToText(c.lastMessagePreview.body?.content ?? ""),
        from: c.lastMessagePreview.from?.user?.displayName ?? null,
        at: c.lastMessagePreview.createdDateTime,
      }
    : null,
});

export async function listChats(): Promise<Chat[]> {
  if (DEMO) return demoChats();
  const data = await graph<{ value: GraphChat[] }>(
    "/me/chats?$expand=members,lastMessagePreview&$orderby=lastMessagePreview/createdDateTime desc&$top=40"
  );
  return data.value.filter((c) => c.chatType !== "meeting" || c.lastMessagePreview).map(toChat);
}

export async function listMessages(chatId: string): Promise<ChatMessage[]> {
  if (DEMO) return demoMessages(chatId);
  const data = await graph<{ value: GraphMessage[] }>(`/chats/${encodeURIComponent(chatId)}/messages?$top=40&$orderby=createdDateTime desc`);
  return data.value
    .filter((m) => !m.deletedDateTime)
    .map((m) => ({
      id: m.id,
      createdDateTime: m.createdDateTime,
      from: m.from?.user?.displayName ?? null,
      fromId: m.from?.user?.id ?? null,
      text: m.body.contentType === "html" ? htmlToText(m.body.content) : m.body.content,
      system: m.messageType !== "message",
    }))
    .filter((m) => !m.system && m.text)
    .reverse();
}

export async function sendMessage(chatId: string, text: string) {
  if (DEMO) return demoSend(chatId, text);
  await graph(`/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: { contentType: "html", content: textToHtml(text) } }),
  });
}

/** 1:1-Chat mit einer Person holen oder anlegen (Teams liefert einen
 * bestehenden Chat zurück, statt einen zweiten anzulegen). */
export async function chatWith(myEmail: string, theirEmail: string): Promise<string> {
  if (DEMO) return demoChatWith(theirEmail);
  const member = (email: string) => ({
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: ["owner"],
    "user@odata.bind": `${GRAPH}/users('${email}')`,
  });
  const chat = await graph<{ id: string }>("/chats", {
    method: "POST",
    body: JSON.stringify({ chatType: "oneOnOne", members: [member(myEmail), member(theirEmail)] }),
  });
  return chat.id;
}

/** Titel eines Chats: Thema oder die anderen Teilnehmer */
export function chatTitle(chat: Chat, myEmail: string) {
  if (chat.topic) return chat.topic;
  const others = chat.members.filter((m) => m.email !== myEmail.toLowerCase());
  return others.map((m) => m.displayName ?? m.email).filter(Boolean).join(", ") || "Chat";
}

// ---------- Vorschau ohne Microsoft ----------

const demoStore: { chats: Chat[]; messages: Record<string, ChatMessage[]> } = { chats: [], messages: {} };

function seed() {
  if (demoStore.chats.length) return;
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const me = { displayName: "Vorschau Konto", email: "vorschau@grid-agency.de", userId: "me" };
  demoStore.chats = [
    { id: "demo-chat-1", topic: null, chatType: "oneOnOne", webUrl: null, members: [me, { displayName: "Marine Eichner", email: "marine.eichner@grid-agency.de", userId: "marine" }], lastMessage: null },
    { id: "demo-chat-2", topic: "Huck Content", chatType: "group", webUrl: null, members: [me, { displayName: "Marine Eichner", email: "marine.eichner@grid-agency.de", userId: "marine" }, { displayName: "Tanja Huck", email: null, userId: "tanja" }], lastMessage: null },
  ];
  demoStore.messages = {
    "demo-chat-1": [
      { id: "m1", createdDateTime: ago(90), from: "Marine Eichner", fromId: "marine", text: "Hast du die Banderole schon gesehen?", system: false },
      { id: "m2", createdDateTime: ago(80), from: "Vorschau Konto", fromId: "me", text: "Ja, sieht super aus! Schick sie gern raus.", system: false },
      { id: "m3", createdDateTime: ago(12), from: "Marine Eichner", fromId: "marine", text: "Ist raus 🙌", system: false },
    ],
    "demo-chat-2": [{ id: "m4", createdDateTime: ago(300), from: "Tanja Huck", fromId: "tanja", text: "Content Day am Freitag passt.", system: false }],
  };
  for (const chat of demoStore.chats) {
    const last = demoStore.messages[chat.id].at(-1);
    chat.lastMessage = last ? { text: last.text, from: last.from, at: last.createdDateTime } : null;
  }
}

function demoChats() {
  seed();
  return structuredClone(demoStore.chats).sort((a, b) => (b.lastMessage?.at ?? "").localeCompare(a.lastMessage?.at ?? ""));
}

function demoMessages(chatId: string) {
  seed();
  return structuredClone(demoStore.messages[chatId] ?? []);
}

function demoSend(chatId: string, text: string) {
  seed();
  const message = { id: `m${Date.now()}`, createdDateTime: new Date().toISOString(), from: "Vorschau Konto", fromId: "me", text, system: false };
  (demoStore.messages[chatId] ??= []).push(message);
  const chat = demoStore.chats.find((c) => c.id === chatId);
  if (chat) chat.lastMessage = { text, from: message.from, at: message.createdDateTime };
}

function demoChatWith(email: string) {
  seed();
  const existing = demoStore.chats.find((c) => c.chatType === "oneOnOne" && c.members.some((m) => m.email === email));
  if (existing) return existing.id;
  const id = `demo-chat-${demoStore.chats.length + 1}`;
  demoStore.chats.push({
    id,
    topic: null,
    chatType: "oneOnOne",
    webUrl: null,
    members: [{ displayName: "Vorschau Konto", email: "vorschau@grid-agency.de", userId: "me" }, { displayName: email, email, userId: email }],
    lastMessage: null,
  });
  return id;
}
