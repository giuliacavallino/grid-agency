import "server-only";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import {
  berlinDate,
  buildRecurrence,
  DURATIONS,
  endLabel,
  isEmail,
  lastOccurrence,
  localString,
  MAX_OCCURRENCES,
  parseLocal,
  RHYTHMS,
  rhythmLabel,
  type JourFix,
  type JourFixInput,
  type SeriesEnd,
} from "@/lib/jourfix";
import { appGraph, mailboxPath } from "./graph-app";
import { db, type Row } from "./db";
import { meetEnabled, meetUrl, newCode, seriesSlot, type SeriesRecurrence } from "./meet";

// Jour fixe: Serie im Outlook-Postfach (App-Graph, Calendars.ReadWrite) mit
// einem festen Raum unter meet.grid-agency.de für alle Termine. Outlook
// verschickt die Serieneinladung. Im Vorschaumodus nur im Speicher.

export class JourFixError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const YEAR = 365 * 86_400_000;

/** Eingaben prüfen und vereinheitlichen; wirft JourFixError mit Text für die Oberfläche */
export async function validate(body: unknown, user: { email: string }): Promise<JourFixInput> {
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

  const title = text(input.title, 200);
  if (!title) throw new JourFixError("Bitte einen Titel eintragen.");

  const customerId = text(input.customer_id, 80) || null;
  if (customerId && !(await db().get("customers", customerId))) throw new JourFixError("Diesen Kunden gibt es nicht.");

  const raw = Array.isArray(input.attendees) ? input.attendees : [];
  const attendees = [...new Set(raw.map((a) => text(a, 254).toLowerCase()).filter(Boolean))];
  const invalid = attendees.filter((a) => !isEmail(a));
  if (invalid.length) throw new JourFixError(`Keine gültige E-Mail-Adresse: ${invalid.join(", ")}`);
  if (!attendees.length) throw new JourFixError("Bitte mindestens eine Person einladen.");
  if (attendees.length > 50) throw new JourFixError("Höchstens 50 Teilnehmer*innen.");

  const start = text(input.start, 16);
  const startMs = parseLocal(start);
  if (startMs === null) throw new JourFixError("Bitte Datum und Uhrzeit für den Beginn angeben.");
  if (berlinDate(startMs) < berlinDate(Date.now())) throw new JourFixError("Der Beginn liegt in der Vergangenheit.");
  if (startMs > Date.now() + 2 * YEAR) throw new JourFixError("Der Beginn liegt zu weit in der Zukunft.");

  const minutes = Number(input.minutes);
  if (!DURATIONS.includes(minutes as (typeof DURATIONS)[number])) throw new JourFixError("Dauer bitte 30, 45, 60 oder 90 Minuten.");

  const rhythm = RHYTHMS.find((r) => r.id === input.rhythm)?.id;
  if (!rhythm) throw new JourFixError("Bitte einen Rhythmus wählen.");

  const endInput = (input.end ?? {}) as Record<string, unknown>;
  let end: SeriesEnd;
  if (endInput.type === "endDate") {
    const date = text(endInput.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new JourFixError("Bitte ein Ende-Datum angeben.");
    if (date <= berlinDate(startMs)) throw new JourFixError("Das Ende-Datum muss nach dem Beginn liegen.");
    if (Date.parse(date) > startMs + 3 * YEAR) throw new JourFixError("Das Ende-Datum liegt mehr als drei Jahre nach dem Beginn.");
    end = { type: "endDate", date };
  } else if (endInput.type === "numbered") {
    const count = Number(endInput.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_OCCURRENCES) {
      throw new JourFixError(`Anzahl der Termine bitte zwischen 1 und ${MAX_OCCURRENCES}.`);
    }
    end = { type: "numbered", count };
  } else if (endInput.type === "noEnd" || endInput.type === undefined) {
    end = { type: "noEnd" };
  } else {
    throw new JourFixError("Unbekanntes Ende der Serie.");
  }

  const video = input.video !== false;
  const location = video ? "" : text(input.location, 200);
  if (!video && !location) throw new JourFixError("Ohne Video-Call bitte einen Ort angeben.");

  const mailbox = (text(input.mailbox, 254) || user.email).toLowerCase();
  if (mailbox !== user.email.toLowerCase() && mailbox !== SHARED_MAILBOX) {
    throw new JourFixError("Als Organisator geht nur dein eigenes Postfach oder hello@.");
  }

  return { title, customer_id: customerId, attendees, start, minutes, rhythm, end, video, location, mailbox };
}

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Einladungstext; mit Video-Call Link zum Raum (gilt für alle Termine) */
function bodyHtml(input: JourFixInput, label: string, url: string | null) {
  const lines = [`<p>Hallo,</p>`, `<p>hier ist unser Jour fixe: ${escapeHtml(label)}.</p>`];
  if (url) {
    lines.push(
      `<p>Zum Video-Call (gilt für jeden Termin der Serie):<br><a href="${url}">${url}</a></p>`,
      `<p>Einfach zur Uhrzeit den Link öffnen, Namen eintragen und beitreten. Es braucht keine App und kein Konto.</p>`
    );
  } else {
    lines.push(`<p>Ort: ${escapeHtml(input.location)}</p>`);
  }
  lines.push(`<p>Viele Grüße<br>GRID AGENCY</p>`);
  return lines.join("\n");
}

function toJourFix(row: Row): JourFix {
  const recurrence = row.recurrence as SeriesRecurrence;
  const room = { starts_at: String(row.starts_at), ends_at: String(row.ends_at), recurrence };
  const { start, minutes } = seriesSlot(room);
  const ended = !!row.cancelled_at || start + minutes * 60_000 < Date.now();
  return {
    id: row.id,
    title: String(row.title),
    customer_id: (row.customer_id as string | null) ?? null,
    url: recurrence.video === false ? null : meetUrl(String(row.code)),
    starts_at: room.starts_at,
    minutes,
    recurrence: { pattern: recurrence.pattern, range: recurrence.range },
    rhythm: rhythmLabel(recurrence, room.starts_at),
    end: endLabel(recurrence),
    next: ended ? null : new Date(start).toISOString(),
    mailbox: (row.mailbox as string | null) ?? null,
    location: recurrence.location ?? null,
    cancelled_at: (row.cancelled_at as string | null) ?? null,
  };
}

/** Laufende Jour fixe (optional eines Kunden); beendete und abgelaufene fallen weg */
export async function listJourFix(customerId?: string | null) {
  const rows = await db().list("meetings", customerId ? { customer_id: customerId } : {});
  return rows
    .filter((row) => row.recurrence && !row.cancelled_at)
    .map(toJourFix)
    .filter((j) => j.next)
    .sort((a, b) => a.next!.localeCompare(b.next!));
}

/** Serie anlegen: Raum (meetings) und Outlook-Serie im Organisator-Postfach */
export async function createJourFix(input: JourFixInput, user: { email: string; name: string }) {
  if (input.video && !meetEnabled() && !DEMO) throw new JourFixError("Video-Calls sind gerade nicht verfügbar.", 503);
  const start = parseLocal(input.start)!;
  const recurrence = buildRecurrence(start, input.rhythm, input.end);
  const last = lastOccurrence(recurrence, start);
  const code = newCode();
  const url = input.video ? meetUrl(code) : null;

  const row = await db().insert("meetings", {
    code,
    title: input.title,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(start + input.minutes * 60_000).toISOString(),
    host: input.mailbox,
    host_name: user.name,
    customer_id: input.customer_id,
    participants: [],
    recurrence: { ...recurrence, video: input.video, location: input.video ? null : input.location },
    // Serie mit Ende: Raum bis zum letzten Termin (+ 7 Tage); ohne Ende offen
    valid_until: last ? new Date(last + input.minutes * 60_000).toISOString() : null,
    mailbox: input.mailbox,
    ...(DEMO ? { group_id: `demo-group-${code}`, event_id: null, cancelled_at: null, lead_id: null, application_id: null } : {}),
  });

  if (DEMO) {
    const event_id = `demo-series-${row.id}`;
    return toJourFix(await db().update("meetings", row.id, { event_id }));
  }

  try {
    const event = await appGraph<{ id: string }>(`${mailboxPath(input.mailbox)}/events`, {
      method: "POST",
      body: JSON.stringify({
        subject: input.title,
        body: { contentType: "HTML", content: bodyHtml(input, rhythmLabel(recurrence, start), url) },
        start: { dateTime: localString(start), timeZone: "Europe/Berlin" },
        end: { dateTime: localString(start + input.minutes * 60_000), timeZone: "Europe/Berlin" },
        location: url ? { displayName: url, locationUri: url } : { displayName: input.location },
        attendees: input.attendees.map((address) => ({ emailAddress: { address }, type: "required" })),
        recurrence,
        allowNewTimeProposals: true,
        showAs: "busy",
      }),
    });
    return toJourFix(await db().update("meetings", row.id, { event_id: event.id }));
  } catch (error) {
    // Ohne Outlook-Serie auch keinen Raum behalten
    await db().remove("meetings", row.id).catch((e) => console.error(e));
    throw error;
  }
}

/** Serie beenden: in Outlook endet sie heute (vergangene Termine bleiben,
 * Outlook schickt die Änderung an alle), danach ist der Raum zu. */
export async function endJourFix(id: string) {
  const row = await db().get("meetings", id);
  if (!row || !row.recurrence) throw new JourFixError("Diesen Jour fixe gibt es nicht.", 404);
  if (row.cancelled_at) throw new JourFixError("Dieser Jour fixe ist schon beendet.", 409);
  const recurrence = row.recurrence as SeriesRecurrence;
  const today = berlinDate(Date.now());
  const range = { type: "endDate" as const, startDate: recurrence.range.startDate, endDate: today };

  if (!DEMO && row.event_id && row.mailbox) {
    const path = `${mailboxPath(String(row.mailbox))}/events/${encodeURIComponent(String(row.event_id))}`;
    if (recurrence.range.startDate > today) {
      // Serie hat noch nicht begonnen: ganz absagen (Outlook schickt Absagen)
      await appGraph(`${path}/cancel`, { method: "POST", body: JSON.stringify({ comment: "Der Jour fixe findet nicht statt." }) });
    } else {
      await appGraph(path, { method: "PATCH", body: JSON.stringify({ recurrence: { pattern: recurrence.pattern, range } }) });
    }
  }

  const now = new Date().toISOString();
  return db().update("meetings", id, {
    recurrence: { ...recurrence, range: recurrence.range.startDate > today ? recurrence.range : range },
    valid_until: now,
    cancelled_at: now,
  });
}
