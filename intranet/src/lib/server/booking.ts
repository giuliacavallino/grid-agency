import "server-only";
import { DEMO, DOMAIN, SHARED_MAILBOX } from "@/lib/config";
import { appGraph, mailboxPath } from "./graph-app";
import { db, sb } from "./db";

// Erstgespräch-Buchung von der Website (statt Calendly). Freie Zeiten kommen
// aus Giulias Kalender und dem von hello@; gebucht wird im Kalender von
// hello@ als Organisator, Giulia und der Kunde werden eingeladen (Teams-Link),
// die Anfrage landet als Lead in Sales → Pipeline (Stage „Erstgespräch“).
// Braucht in Entra zusätzlich die Anwendungsberechtigung Calendars.ReadWrite
// mit Admin-Zustimmung (am besten per Application Access Policy auf hello@
// und Giulia beschränkt).

export const BOOKING = {
  organizer: SHARED_MAILBOX,
  host: `giulia.cavallino@${DOMAIN}`,
  hostName: "Giulia Cavallino",
  tz: "Europe/Berlin",
  minutes: 30,
  /** Puffer vor und nach jedem bestehenden Termin */
  bufferMinutes: 15,
  /** Buchbare Zeit je Werktag (Mo–Fr), lokale Uhrzeit */
  dayStart: 10,
  dayEnd: 17,
  /** Frühestens so viele Stunden ab jetzt */
  noticeHours: 18,
  /** So viele Tage im Voraus */
  days: 21,
} as const;

export type Slot = { start: string; end: string };

/** Offset der Zeitzone zu UTC in Minuten für einen Zeitpunkt. */
function tzOffset(at: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return (asUtc - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000;
}

/** Lokale Wanduhrzeit in der Zeitzone → UTC-Zeitpunkt (auch über die Zeitumstellung). */
function zoned(y: number, m: number, d: number, h: number, min: number, tz: string) {
  const guess = Date.UTC(y, m, d, h, min);
  let at = new Date(guess - tzOffset(new Date(guess), tz) * 60_000);
  at = new Date(guess - tzOffset(at, tz) * 60_000);
  return at;
}

/** Lokales Datum (Jahr, Monat, Tag) eines Zeitpunkts in der Zeitzone. */
function localDay(at: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  return { y: +parts.year, m: +parts.month - 1, d: +parts.day };
}

type Busy = { start: number; end: number };

/** Belegte Zeiten von Giulia und hello@ (frei und „woanders arbeiten“ zählen als frei). */
async function busyTimes(from: Date, to: Date): Promise<Busy[]> {
  if (DEMO) {
    // Vorschau: jeden Tag 12–13 Uhr belegt
    const out: Busy[] = [];
    for (let t = from.getTime(); t < to.getTime(); t += 86_400_000) {
      const { y, m, d } = localDay(new Date(t), BOOKING.tz);
      out.push({ start: zoned(y, m, d, 12, 0, BOOKING.tz).getTime(), end: zoned(y, m, d, 13, 0, BOOKING.tz).getTime() });
    }
    return out;
  }
  const data = await appGraph<{
    value: { scheduleItems?: { status: string; start: { dateTime: string }; end: { dateTime: string } }[]; error?: { message: string } }[];
  }>(`${mailboxPath(BOOKING.organizer)}/calendar/getSchedule`, {
    method: "POST",
    headers: { Prefer: 'outlook.timezone="UTC"' },
    body: JSON.stringify({
      schedules: [BOOKING.host, BOOKING.organizer],
      startTime: { dateTime: from.toISOString().slice(0, 19), timeZone: "UTC" },
      endTime: { dateTime: to.toISOString().slice(0, 19), timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  });
  const failed = data.value.find((s) => s.error);
  if (failed) throw new Error(`Kalender nicht lesbar: ${failed.error?.message}`);
  return data.value.flatMap((s) =>
    (s.scheduleItems ?? [])
      .filter((i) => i.status !== "free" && i.status !== "workingElsewhere")
      .map((i) => ({ start: Date.parse(`${i.start.dateTime}Z`), end: Date.parse(`${i.end.dateTime}Z`) }))
  );
}

/** Freie Erstgespräch-Zeiten der nächsten Wochen. */
export async function freeSlots(now = new Date()): Promise<Slot[]> {
  const earliest = now.getTime() + BOOKING.noticeHours * 3_600_000;
  const until = new Date(now.getTime() + BOOKING.days * 86_400_000);
  const busy = await busyTimes(now, until);
  const buffer = BOOKING.bufferMinutes * 60_000;
  const length = BOOKING.minutes * 60_000;
  const slots: Slot[] = [];

  const today = localDay(now, BOOKING.tz);
  for (let i = 0; i <= BOOKING.days; i++) {
    // Kalendertage zählen statt 24 Stunden addieren (Zeitumstellung)
    const day = new Date(Date.UTC(today.y, today.m, today.d + i));
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()];
    if (day.getUTCDay() === 0 || day.getUTCDay() === 6) continue;
    const dayEnd = zoned(y, m, d, BOOKING.dayEnd, 0, BOOKING.tz).getTime();
    for (let s = zoned(y, m, d, BOOKING.dayStart, 0, BOOKING.tz).getTime(); s + length <= dayEnd; s += length) {
      if (s < earliest) continue;
      const e = s + length;
      if (busy.some((b) => s < b.end + buffer && e > b.start - buffer)) continue;
      slots.push({ start: new Date(s).toISOString(), end: new Date(e).toISOString() });
    }
  }
  return slots;
}

export type BookingInput = {
  start: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  /** Firmenanschrift aus dem Buchungs-Popup */
  address?: { street?: string; number?: string; zip?: string; city?: string; country?: string };
};

/** Anschrift einzeilig, z. B. „Musterstraße 1, 10115 Berlin, Deutschland“. */
const addressLine = (a: BookingInput["address"]) =>
  a
    ? [[a.street, a.number].filter(Boolean).join(" "), [a.zip, a.city].filter(Boolean).join(" "), a.country]
        .filter(Boolean)
        .join(", ")
    : "";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const localTime = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: BOOKING.tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/** Bucht ein Erstgespräch: Termin bei hello@ mit Einladung an Giulia und
 * Kunde, danach Lead in der Pipeline (Stage „Erstgespräch“). Mit `leadId`
 * (Einladungslink) bzw. bei offenem Lead mit derselben E-Mail wird dieser
 * Lead verschoben statt ein neuer angelegt. Liefert null, wenn die Zeit
 * nicht (mehr) frei ist. */
export async function book(input: BookingInput, leadId: string | null = null) {
  const slot = (await freeSlots()).find((s) => s.start === new Date(input.start).toISOString());
  if (!slot) return null;

  const who = input.company ? `${input.company} (${input.name})` : input.name;
  const address = addressLine(input.address);
  const note = [input.message, address && `Anschrift: ${address}`].filter(Boolean).join("\n\n");
  const body = [
    `<p>Erstgespräch über grid-agency.de gebucht.</p>`,
    `<p><b>${escape(input.name)}</b>${input.company ? `, ${escape(input.company)}` : ""}<br>`,
    address ? `${escape(address)}<br>` : "",
    `${escape(input.email)}${input.phone ? `<br>${escape(input.phone)}` : ""}</p>`,
    input.message ? `<p>${escape(input.message).replace(/\n/g, "<br>")}</p>` : "",
  ].join("");

  let eventId = `demo-${slot.start}`;
  let joinUrl: string | null = DEMO ? "https://teams.microsoft.com/l/meetup-join/demo" : null;
  if (!DEMO) {
    const event = {
      subject: `Erstgespräch GRID × ${who}`,
      body: { contentType: "HTML", content: body },
      start: { dateTime: slot.start.slice(0, 19), timeZone: "UTC" },
      end: { dateTime: slot.end.slice(0, 19), timeZone: "UTC" },
      attendees: [
        { type: "required", emailAddress: { address: BOOKING.host, name: BOOKING.hostName } },
        { type: "required", emailAddress: { address: input.email, name: input.name } },
      ],
      allowNewTimeProposals: true,
      // Doppelte Absendung (Doppelklick, Retry) legt keinen zweiten Termin an
      transactionId: `website-${slot.start}-${input.email.toLowerCase()}`,
    };
    const create = (online: boolean) =>
      appGraph<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>(`${mailboxPath(BOOKING.organizer)}/calendar/events`, {
        method: "POST",
        body: JSON.stringify(online ? { ...event, isOnlineMeeting: true, onlineMeetingProvider: "teamsForBusiness" } : event),
      });
    // Ohne Teams-Lizenz am Organisator-Postfach scheitert der Teams-Link;
    // dann gibt es den Termin ohne und den Link schickt Giulia nach.
    const created = await create(true).catch(() => create(false));
    eventId = created.id;
    joinUrl = created.onlineMeeting?.joinUrl ?? null;
  }

  const meeting = {
    stage: "erstgespraech",
    position: Date.now() / 1000,
    meeting_at: slot.start,
    meeting_url: joinUrl,
    meeting_event_id: eventId,
    next_step: "Erstgespräch",
    next_step_at: slot.start,
  };
  // Eingeladener oder schon bekannter Lead: verschieben statt doppelt anlegen
  let lead = leadId ? await db().get("leads", leadId) : null;
  if (!lead && !DEMO) {
    const { data } = await sb().from("leads").select("*").eq("status", "offen").ilike("email", input.email).limit(1).maybeSingle();
    lead = data ?? null;
  }
  if (lead) {
    lead = await db().update("leads", lead.id, {
      ...meeting,
      ...(!lead.phone && input.phone ? { phone: input.phone } : {}),
      ...(!lead.company && input.company ? { company: input.company } : {}),
      ...(!lead.message && note ? { message: note } : {}),
    });
  } else {
    lead = await db().insertIgnore("leads", {
      ...meeting,
      source: "website",
      source_ref: `termin:${eventId}`,
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      company: input.company || null,
      // Anschrift sichtbar in der Nachricht, strukturiert in raw (für den Kunden-Datensatz)
      message: note || null,
      raw: { booking: { address: input.address ?? null } },
      owner: BOOKING.host,
    });
  }
  if (lead) {
    await db().insert("lead_activities", {
      lead_id: lead.id,
      kind: "termin",
      author: "Website",
      body: `Erstgespräch gebucht für ${localTime(slot.start)} Uhr`,
    });
  }
  return { ...slot, url: joinUrl };
}
