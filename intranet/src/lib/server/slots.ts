import "server-only";
import { DEMO } from "@/lib/config";
import { appGraph, mailboxPath } from "./graph-app";
import { createRoom, meetEnabled, type RoomLink } from "./meet";

// Freie Termine aus einem Outlook-Kalender und Termin anlegen (Video-Call
// unter meet.grid-agency.de, ohne ACS-Zugang als Teams-Besprechung).
// Gemeinsam für Vorstellungsgespräche (Personal) und Erstgespräche/Kick-offs
// (Sales). Braucht die Anwendungsberechtigung Calendars.ReadWrite.

export type SlotRules = {
  /** Gesprächsdauer in Minuten */
  minutes: number;
  /** Zeitfenster in Berliner Stunden, z. B. 10–17 */
  dayStart: number;
  dayEnd: number;
  /** Frühester Slot: so viele Stunden ab jetzt … */
  leadHours?: number;
  /** … oder erst ab dem nächsten Werktag (ab morgen) */
  fromTomorrow?: boolean;
  daysAhead: number;
  /** Freie Zeit vor und nach anderen Terminen */
  bufferMinutes?: number;
};

export type Busy = { start: number; end: number };

const TZ = "Europe/Berlin";

const berlinParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Wanduhrzeit in Berlin als UTC-Millisekunden gelesen */
function berlinWall(ms: number) {
  const p = Object.fromEntries(berlinParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
}

/** Berliner Ortszeit → Zeitpunkt (inkl. Sommer-/Winterzeit) */
function fromBerlin(year: number, month: number, day: number, hour: number, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall - (berlinWall(wall) - wall);
  utc = wall - (berlinWall(utc) - utc);
  return utc;
}

/** Mögliche Slot-Anfänge der nächsten Werktage, ohne Rücksicht auf den Kalender */
export function candidateSlots(rules: SlotRules, now = Date.now()) {
  const today = new Date(berlinWall(now));
  const earliest = rules.fromTomorrow ? 0 : now + (rules.leadHours ?? 0) * 3_600_000;
  const slots: number[] = [];
  for (let offset = 1; offset <= rules.daysAhead; offset++) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (let minutes = rules.dayStart * 60; minutes + rules.minutes <= rules.dayEnd * 60; minutes += rules.minutes) {
      const start = fromBerlin(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(minutes / 60), minutes % 60);
      if (start >= earliest) slots.push(start);
    }
  }
  return slots;
}

/** Belegte Zeiten im Outlook-Kalender (gebucht, mit Vorbehalt, abwesend) */
export async function busyTimes(mailbox: string, from: number, to: number, rules: SlotRules): Promise<Busy[]> {
  if (DEMO) {
    // Vorschau: jeden Tag ein paar feste Termine
    return candidateSlots(rules, from - 86_400_000)
      .filter((start) => new Date(start).getUTCHours() % 3 === 0)
      .map((start) => ({ start, end: start + 60 * 60_000 }));
  }
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
  const data = await appGraph<{ value: { scheduleItems?: { status: string; start: { dateTime: string }; end: { dateTime: string } }[] }[] }>(
    `${mailboxPath(mailbox)}/calendar/getSchedule`,
    {
      method: "POST",
      headers: { Prefer: 'outlook.timezone="UTC"' },
      body: JSON.stringify({
        schedules: [mailbox],
        startTime: { dateTime: iso(from), timeZone: "UTC" },
        endTime: { dateTime: iso(to), timeZone: "UTC" },
        availabilityViewInterval: Math.min(rules.minutes, 30),
      }),
    }
  );
  return (data.value[0]?.scheduleItems ?? [])
    .filter((item) => item.status !== "free" && item.status !== "workingElsewhere")
    .map((item) => ({ start: Date.parse(`${item.start.dateTime}Z`), end: Date.parse(`${item.end.dateTime}Z`) }));
}

/** Freie Slots: Kandidaten ohne Überschneidung mit Kalender und `extra`
 * (schon gebuchte Termine, die Outlook evtl. noch nicht als belegt meldet) */
export async function freeSlots(mailbox: string, rules: SlotRules, extra: Busy[] = []) {
  const candidates = candidateSlots(rules);
  if (!candidates.length) return [];
  const buffer = (rules.bufferMinutes ?? 0) * 60_000;
  const calendar = await busyTimes(mailbox, candidates[0] - buffer, candidates[candidates.length - 1] + rules.minutes * 60_000 + buffer, rules);
  const busy = [...calendar, ...extra];
  return candidates.filter((start) => {
    const end = start + rules.minutes * 60_000;
    return !busy.some((b) => b.start < end + buffer && b.end > start - buffer);
  });
}

/** Termin im Kalender anlegen; Outlook lädt die Teilnehmenden ein. Online
 * mit Raum unter meet.grid-agency.de (Link in Ort und Text), ohne ACS als
 * Teams-Besprechung; mit `location` vor Ort. */
export async function createMeeting(
  mailbox: string,
  input: { subject: string; text: string; start: number; minutes: number; attendee: { email: string; name: string }; location?: string; hostName?: string; link?: RoomLink }
) {
  if (DEMO) return { id: `demo-event-${input.start}`, joinUrl: "https://meet.grid-agency.de/demo" };
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
  const room =
    !input.location && meetEnabled()
      ? await createRoom({ title: input.subject, start: input.start, minutes: input.minutes, host: mailbox, hostName: input.hostName, link: input.link })
      : null;
  const online = room
    ? { location: { displayName: room.url, locationUri: room.url } }
    : input.location
      ? { location: { displayName: input.location } }
      : { isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" };
  const event = await appGraph<{ id: string; onlineMeeting?: { joinUrl?: string } | null; webLink?: string }>(`${mailboxPath(mailbox)}/events`, {
    method: "POST",
    body: JSON.stringify({
      subject: input.subject,
      body: { contentType: "Text", content: room ? `${input.text}\n\nZum Video-Call: ${room.url}` : input.text },
      start: { dateTime: iso(input.start), timeZone: "UTC" },
      end: { dateTime: iso(input.start + input.minutes * 60_000), timeZone: "UTC" },
      attendees: [{ emailAddress: { address: input.attendee.email, name: input.attendee.name }, type: "required" }],
      ...online,
      allowNewTimeProposals: true,
      showAs: "busy",
    }),
  });
  return { id: event.id, joinUrl: room?.url ?? event.onlineMeeting?.joinUrl ?? null };
}
