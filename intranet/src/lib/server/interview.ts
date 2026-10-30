import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import { db, type Row } from "./db";
import { appGraph, mailboxPath, sendAppMail } from "./graph-app";

// Einladung zum Vorstellungsgespräch: Ein Klick auf der Bewerbungskarte
// schickt von hello@ eine Mail mit geheimem Link (nur dessen SHA-256 liegt in
// der Datenbank). Über den Link wählt die Person einen freien Slot aus dem
// Outlook-Kalender der einladenden Person; der Termin wird dort als
// Teams-Besprechung angelegt, Outlook schickt die Einladung. Ohne Link gibt
// es keine Buchung. Braucht in Entra die Anwendungsberechtigung
// Calendars.ReadWrite (Frei/Gebucht lesen, Termin anlegen) und Mail.Send.

export class InviteError extends Error {}

export const INVITE_URL = process.env.SIGN_URL ?? "https://sign.grid-agency.de";

/** Gesprächsdauer, Zeitfenster und Vorlauf der Slots (Zeiten in Berlin) */
const SLOT_MINUTES = 30;
const DAY_START = 9;
const DAY_END = 17;
const LEAD_HOURS = 18;
const DAYS_AHEAD = 14;
const TZ = "Europe/Berlin";

const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// ---------- Zeit in Berlin ----------

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
function candidateSlots(now = Date.now()) {
  const today = new Date(berlinWall(now));
  const earliest = now + LEAD_HOURS * 3_600_000;
  const slots: number[] = [];
  for (let offset = 1; offset <= DAYS_AHEAD; offset++) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
    const weekday = day.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    for (let minutes = DAY_START * 60; minutes + SLOT_MINUTES <= DAY_END * 60; minutes += SLOT_MINUTES) {
      const start = fromBerlin(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Math.floor(minutes / 60), minutes % 60);
      if (start >= earliest) slots.push(start);
    }
  }
  return slots;
}

// ---------- Kalender ----------

type Busy = { start: number; end: number };

/** Belegte Zeiten im Outlook-Kalender (gebucht, mit Vorbehalt, abwesend) */
async function busyTimes(mailbox: string, from: number, to: number): Promise<Busy[]> {
  if (DEMO) {
    // Vorschau: jeden Tag ein paar feste Termine
    return candidateSlots(from - LEAD_HOURS * 3_600_000)
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
        availabilityViewInterval: SLOT_MINUTES,
      }),
    }
  );
  return (data.value[0]?.scheduleItems ?? [])
    .filter((item) => item.status !== "free" && item.status !== "workingElsewhere")
    .map((item) => ({ start: Date.parse(`${item.start.dateTime}Z`), end: Date.parse(`${item.end.dateTime}Z`) }));
}

/** Schon gebuchte Gespräche dieser Person, auch wenn Outlook sie noch nicht
 * als belegt meldet (zwei Buchungen kurz nacheinander) */
async function bookedInterviews(mailbox: string): Promise<Busy[]> {
  const rows = await db().list("applications", { invited_by: mailbox });
  return rows
    .filter((row) => row.interview_at)
    .map((row) => {
      const start = Date.parse(String(row.interview_at));
      return { start, end: start + SLOT_MINUTES * 60_000 };
    });
}

async function freeSlots(mailbox: string) {
  const candidates = candidateSlots();
  if (!candidates.length) return [];
  const [calendar, booked] = await Promise.all([
    busyTimes(mailbox, candidates[0], candidates[candidates.length - 1] + SLOT_MINUTES * 60_000),
    bookedInterviews(mailbox),
  ]);
  const busy = [...calendar, ...booked];
  return candidates.filter((start) => {
    const end = start + SLOT_MINUTES * 60_000;
    return !busy.some((b) => b.start < end && b.end > start);
  });
}

async function createEvent(application: Row, start: number) {
  const mailbox = String(application.invited_by);
  const name = String(application.name);
  if (DEMO) return { id: `demo-event-${start}`, joinUrl: "https://teams.microsoft.com/l/meetup-join/demo" };
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);
  // Der Text geht mit der Einladung an die Person, daher nichts Internes
  const event = await appGraph<{ id: string; onlineMeeting?: { joinUrl?: string } | null; webLink?: string }>(
    `${mailboxPath(mailbox)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        subject: `Kennenlernen GRID × ${name}`,
        body: {
          contentType: "Text",
          content: `Hi ${firstName(name)},\n\nschön, dass es klappt! Wir sprechen per Microsoft Teams, den Link findest du in diesem Termin.\n\nBis bald\n${application.invited_by_name ?? "GRID"}\nGRID Agency`,
        },
        start: { dateTime: iso(start), timeZone: "UTC" },
        end: { dateTime: iso(start + SLOT_MINUTES * 60_000), timeZone: "UTC" },
        attendees: [{ emailAddress: { address: application.email, name }, type: "required" }],
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        allowNewTimeProposals: true,
        showAs: "busy",
      }),
    }
  );
  return { id: event.id, joinUrl: event.onlineMeeting?.joinUrl ?? event.webLink ?? null };
}

// ---------- Einladen (Hub) ----------

function inviteMail(application: Row, inviter: { name: string }, link: string) {
  const name = firstName(String(application.name));
  const title = String(application.position_title ?? "");
  const initiative = !title || title === "Initiativbewerbung";
  const role = initiative ? "deine Initiativbewerbung" : `deine Bewerbung als ${title}`;
  const from = firstName(inviter.name);
  const text = `Hi ${name},

danke für ${role}! Wir würden dich gern kennenlernen. Such dir einfach einen Termin für ein ${SLOT_MINUTES}-minütiges Gespräch per Teams mit ${from} aus:

${link}

Falls keiner der Termine passt, antworte einfach auf diese Mail.

Bis bald
${inviter.name}
GRID Agency`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#2b2926;max-width:520px">
<p>Hi ${escape(name)},</p>
<p>danke für ${escape(role)}! Wir würden dich gern kennenlernen. Such dir einfach einen Termin für ein ${SLOT_MINUTES}-minütiges Gespräch per Teams mit ${escape(from)} aus:</p>
<p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#2b2926;color:#e4e2e7;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:999px">Termin wählen</a></p>
<p style="font-size:13px;color:#676159">Oder diesen Link öffnen: <a href="${link}" style="color:#676159">${link}</a></p>
<p>Falls keiner der Termine passt, antworte einfach auf diese Mail.</p>
<p>Bis bald<br>${escape(inviter.name)}<br>GRID Agency</p>
</div>`;
  return { subject: "Einladung zum Kennenlernen bei GRID", text, html };
}

/** Lädt zum Vorstellungsgespräch ein: neuer Link, Mail von hello@, Karte
 * nach „Gespräch“. Erneut einladen ersetzt den alten Link. */
export async function inviteApplication(id: string, inviter: { email: string; name: string }) {
  const store = db();
  const application = await store.get("applications", id);
  if (!application) throw new InviteError("Bewerbung nicht gefunden");
  if (!application.email) throw new InviteError("Keine E-Mail-Adresse hinterlegt");
  if (application.interview_at) throw new InviteError("Termin ist schon gebucht");

  const token = randomBytes(24).toString("base64url");
  const link = `${INVITE_URL}/t/${token}`;
  const previous = Object.fromEntries(
    ["invite_token_hash", "invited_at", "invited_by", "invited_by_name", "stage", "position", "next_step", "next_step_at"].map((k) => [k, application[k] ?? null])
  );
  const updated = await store.update("applications", id, {
    invite_token_hash: sha256(token),
    invited_at: new Date().toISOString(),
    invited_by: inviter.email,
    invited_by_name: inviter.name,
    stage: "gespraech",
    position: Date.now() / 1000,
    next_step: "Wartet auf Terminwahl",
    next_step_at: null,
  });

  const mail = inviteMail(application, inviter, link);
  if (DEMO) {
    console.info(`[Vorschau] Einladung an ${application.email}: ${link}`);
    return { application: updated, link };
  }
  try {
    await sendAppMail(SHARED_MAILBOX, { to: [String(application.email)], subject: mail.subject, body: mail.html, html: true });
  } catch (error) {
    await store.update("applications", id, previous);
    console.error(error);
    throw new InviteError("Mail konnte nicht gesendet werden (Anwendungsberechtigung Mail.Send?)");
  }
  return { application: updated, link: null };
}

// ---------- Öffentlich (Link aus der Mail) ----------

async function byToken(token: string) {
  if (!/^[\w-]{20,64}$/.test(token)) throw new InviteError("Dieser Link ist ungültig.");
  const [row] = await db().list("applications", { invite_token_hash: sha256(token) });
  if (!row) throw new InviteError("Dieser Link ist ungültig oder wurde durch eine neue Einladung ersetzt.");
  return row;
}

export type InviteView = {
  first_name: string;
  position_title: string | null;
  inviter: string;
  minutes: number;
  booked: { start: string; url: string | null } | null;
  /** Freie Slot-Anfänge (ISO), leer wenn gebucht */
  slots: string[];
  calendar_error: boolean;
};

export async function publicInvite(token: string): Promise<InviteView> {
  const row = await byToken(token);
  const view: InviteView = {
    first_name: firstName(String(row.name)),
    position_title: (row.position_title as string) ?? null,
    inviter: String(row.invited_by_name ?? "GRID"),
    minutes: SLOT_MINUTES,
    booked: row.interview_at ? { start: String(row.interview_at), url: (row.interview_url as string) ?? null } : null,
    slots: [],
    calendar_error: false,
  };
  if (view.booked) return view;
  try {
    view.slots = (await freeSlots(String(row.invited_by))).map((ms) => new Date(ms).toISOString());
  } catch (error) {
    console.error(error);
    view.calendar_error = true;
  }
  return view;
}

/** Bucht einen Slot: prüft ihn erneut gegen den Kalender, legt den
 * Teams-Termin an und trägt ihn an der Bewerbung ein. */
export async function bookInterview(token: string, startIso: string) {
  const row = await byToken(token);
  if (row.interview_at) throw new InviteError("Du hast schon einen Termin gebucht.");
  const start = Date.parse(startIso);
  const free = await freeSlots(String(row.invited_by));
  if (!free.includes(start)) throw new InviteError("Dieser Termin ist gerade vergeben worden. Bitte wähl einen anderen.");

  const event = await createEvent(row, start);
  const at = new Date(start).toISOString();
  await db().update("applications", row.id, {
    interview_at: at,
    interview_event_id: event.id,
    interview_url: event.joinUrl,
    stage: "gespraech",
    next_step: "Vorstellungsgespräch",
    next_step_at: at,
  });
  return { start: at, url: event.joinUrl };
}
