import "server-only";
import { randomInt } from "node:crypto";
import { CommunicationIdentityClient } from "@azure/communication-identity";
import { lastOccurrence, nextOccurrence, rhythmLabel, type Recurrence } from "@/lib/jourfix";
import { db, sb } from "./db";

// Video-Calls unter meet.grid-agency.de über Azure Communication Services
// (ACS): Termine bekommen einen Raum mit kurzem Code statt eines
// Teams-Links. Der Raum ist ein ACS-Gruppenanruf; die Zugangstoken stellt
// nur dieser Server aus, und nur für Räume, die es gibt und nicht abgelaufen
// sind. Ohne ACS_CONNECTION_STRING bleibt es bei Teams.

export const MEET_URL = (process.env.MEET_URL ?? "https://meet.grid-agency.de").replace(/\/$/, "");

/** Wie lange ein Raum nach dem Ende noch offen ist (für Verschiebungen) */
const GRACE_MS = 7 * 24 * 60 * 60_000;

/** Ohne verwechselbare Zeichen (0/o, 1/l/i) */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const CODE = /^[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$/;

export class MeetError extends Error {
  constructor(message: string, readonly status = 404) {
    super(message);
  }
}

export const meetEnabled = () => !!process.env.ACS_CONNECTION_STRING;

export const meetUrl = (code: string) => `${MEET_URL}/${code}`;

export function newCode() {
  const chars = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${chars.slice(0, 3)}-${chars.slice(3, 7)}-${chars.slice(7)}`;
}

/** Wozu der Raum gehört; daraus findet die Auswertung das Kundenprojekt */
export type RoomLink = { lead_id?: string | null; customer_id?: string | null; application_id?: string | null };

/** Legt einen Raum für einen Termin an und liefert dessen Link */
export async function createRoom(input: { title: string; start: number; minutes: number; host?: string; hostName?: string; link?: RoomLink }) {
  const code = newCode();
  const { error } = await sb()
    .from("meetings")
    .insert({
      code,
      title: input.title,
      starts_at: new Date(input.start).toISOString(),
      ends_at: new Date(input.start + input.minutes * 60_000).toISOString(),
      host: input.host ?? null,
      host_name: input.hostName ?? null,
      ...input.link,
    });
  if (error) throw new Error(error.message);
  return { code, url: meetUrl(code) };
}

/** Raum nachträglich zuordnen (z. B. sobald der Lead feststeht) */
export async function linkRoom(code: string, link: RoomLink) {
  const { error } = await sb().from("meetings").update(link).eq("code", code);
  if (error) console.error(error);
}

/** Zusätze einer Jour-fixe-Serie im Feld recurrence (neben pattern/range) */
export type SeriesRecurrence = Recurrence & { video?: boolean; location?: string | null };

type Room = {
  id: string;
  code: string;
  group_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  host_name: string | null;
  participants: { name: string; at: string }[] | null;
  recurrence: SeriesRecurrence | null;
  valid_until: string | null;
  cancelled_at: string | null;
};

/** Bis wann der Raum offen ist (ms). Einzeltermin: Ende + 7 Tage.
 * Serie: valid_until + 7 Tage, ohne valid_until unbegrenzt; beendete Serie
 * (cancelled_at) nur bis valid_until, also ab dem Beenden zu. */
export function openUntil(room: Pick<Room, "ends_at" | "recurrence" | "valid_until" | "cancelled_at">) {
  if (!room.recurrence) return Date.parse(room.ends_at) + GRACE_MS;
  if (room.cancelled_at) return Date.parse(room.valid_until ?? room.cancelled_at);
  return room.valid_until ? Date.parse(room.valid_until) + GRACE_MS : Infinity;
}

async function room(code: string) {
  if (!CODE.test(code)) throw new MeetError("Diesen Link gibt es nicht.");
  const [data] = (await db().list("meetings", { code })) as unknown as Room[];
  if (!data) throw new MeetError("Diesen Link gibt es nicht.");
  // Jour fixe ohne Video-Call: Termin mit Ort, der Raum ist nicht in Gebrauch
  if (data.recurrence?.video === false) throw new MeetError("Diesen Link gibt es nicht.");
  if (openUntil({ ...data, recurrence: data.recurrence ?? null, valid_until: data.valid_until ?? null, cancelled_at: data.cancelled_at ?? null }) < Date.now()) {
    throw new MeetError("Dieser Call ist vorbei.", 410);
  }
  return data;
}

/** series: Rhythmus einer Jour-fixe-Serie, z. B. „Jeden Dienstag, 10:00“;
 * starts_at/ends_at sind dann der nächste (oder zuletzt der letzte) Termin. */
export type RoomView = { title: string; starts_at: string; ends_at: string; host_name: string | null; series?: string | null };

/** Nächster Termin einer Serie (bzw. der letzte, wenn keiner mehr kommt) */
export function seriesSlot(room: Pick<Room, "starts_at" | "ends_at" | "recurrence">, now = Date.now()) {
  const minutes = Math.round((Date.parse(room.ends_at) - Date.parse(room.starts_at)) / 60_000);
  if (!room.recurrence) return { start: Date.parse(room.starts_at), minutes };
  const start = nextOccurrence(room.recurrence, room.starts_at, now, minutes) ?? lastOccurrence(room.recurrence, room.starts_at) ?? Date.parse(room.starts_at);
  return { start, minutes };
}

/** Öffentliche Angaben zum Raum für die Vorschau vor dem Beitreten */
export async function roomView(code: string): Promise<RoomView> {
  const data = await room(code);
  const { title, host_name } = data;
  if (!data.recurrence) return { title, starts_at: data.starts_at, ends_at: data.ends_at, host_name };
  const { start, minutes } = seriesSlot(data);
  return {
    title,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + minutes * 60_000).toISOString(),
    host_name,
    series: rhythmLabel(data.recurrence, data.starts_at),
  };
}

/** ID des Raums für die Aufnahme (wirft, wenn es ihn nicht gibt) */
export async function roomId(code: string) {
  return (await room(code)).id;
}

/** Zugang zum Anruf: neue ACS-Identität mit VoIP-Token (4 Stunden). Der
 * Name kommt in die Teilnehmerliste (für die Auswertung des Transkripts). */
export async function joinRoom(code: string, name: string) {
  const { id, group_id, participants } = await room(code);
  if (!meetEnabled()) throw new MeetError("Video-Calls sind gerade nicht verfügbar.", 503);
  const clean = name.trim().slice(0, 80);
  if (clean && !(participants ?? []).some((p) => p.name === clean)) {
    await sb()
      .from("meetings")
      .update({ participants: [...(participants ?? []), { name: clean, at: new Date().toISOString() }] })
      .eq("id", id);
  }
  const client = new CommunicationIdentityClient(process.env.ACS_CONNECTION_STRING!);
  const { token, expiresOn } = await client.createUserAndToken(["voip"], { tokenExpiresInMinutes: 240 });
  return { token, expires_on: expiresOn.toISOString(), group_id };
}
