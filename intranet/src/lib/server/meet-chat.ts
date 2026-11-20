import "server-only";
import { randomUUID } from "node:crypto";
import { DEMO } from "@/lib/config";
import { sb } from "./db";
import { MeetError, roomId } from "./meet";

// Chat im Video-Call: einfache Nachrichten je Raum, abgefragt im Takt von
// wenigen Sekunden. Nur die letzten 12 Stunden (laufender Termin).

export type ChatMessage = { id: string; created_at: string; name: string; text: string };

const WINDOW_MS = 12 * 60 * 60_000;
const demo: (ChatMessage & { meeting_id: string })[] = [];

export async function listMessages(code: string, after?: string | null): Promise<ChatMessage[]> {
  const meetingId = await roomId(code);
  const since = new Date(Math.max(Date.now() - WINDOW_MS, after && !Number.isNaN(Date.parse(after)) ? Date.parse(after) + 1 : 0)).toISOString();
  if (DEMO) return demo.filter((m) => m.meeting_id === meetingId && m.created_at >= since).map(({ meeting_id: _, ...m }) => m);
  const { data, error } = await sb()
    .from("meeting_messages")
    .select("id,created_at,name,text")
    .eq("meeting_id", meetingId)
    .gte("created_at", since)
    .order("created_at")
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as ChatMessage[];
}

export async function postMessage(code: string, name: string, text: string): Promise<ChatMessage> {
  const meetingId = await roomId(code);
  const cleanName = name.trim().slice(0, 80);
  const cleanText = text.trim().slice(0, 2000);
  if (!cleanName) throw new MeetError("Bitte zuerst einen Namen eintragen.", 400);
  if (!cleanText) throw new MeetError("Die Nachricht ist leer.", 400);
  if (DEMO) {
    const message = { id: randomUUID(), created_at: new Date().toISOString(), name: cleanName, text: cleanText, meeting_id: meetingId };
    demo.push(message);
    const { meeting_id: _, ...shown } = message;
    return shown;
  }
  const { data, error } = await sb().from("meeting_messages").insert({ meeting_id: meetingId, name: cleanName, text: cleanText }).select("id,created_at,name,text").single();
  if (error) throw new Error(error.message);
  return data as ChatMessage;
}
