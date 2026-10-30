import "server-only";
import { randomInt } from "node:crypto";
import { CommunicationIdentityClient } from "@azure/communication-identity";
import { sb } from "./db";

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

const meetUrl = (code: string) => `${MEET_URL}/${code}`;

function newCode() {
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

async function room(code: string) {
  if (!CODE.test(code)) throw new MeetError("Diesen Link gibt es nicht.");
  const { data, error } = await sb().from("meetings").select("*").eq("code", code).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new MeetError("Diesen Link gibt es nicht.");
  if (Date.parse(data.ends_at) + GRACE_MS < Date.now()) throw new MeetError("Dieser Call ist vorbei.", 410);
  return data as {
    id: string;
    code: string;
    group_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    host_name: string | null;
    participants: { name: string; at: string }[] | null;
  };
}

export type RoomView = { title: string; starts_at: string; ends_at: string; host_name: string | null };

/** Öffentliche Angaben zum Raum für die Vorschau vor dem Beitreten */
export async function roomView(code: string): Promise<RoomView> {
  const { title, starts_at, ends_at, host_name } = await room(code);
  return { title, starts_at, ends_at, host_name };
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
