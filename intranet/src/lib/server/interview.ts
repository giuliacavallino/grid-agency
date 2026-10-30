import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import { db, type Row } from "./db";
import { sendAppMail } from "./graph-app";
import { createMeeting, freeSlots as freeSlotsIn, type Busy, type SlotRules } from "./slots";

// Einladung zum Vorstellungsgespräch: Ein Klick auf der Bewerbungskarte
// schickt von hello@ eine Mail mit geheimem Link (nur dessen SHA-256 liegt in
// der Datenbank). Über den Link wählt die Person einen freien Slot aus dem
// Outlook-Kalender der einladenden Person; der Termin wird dort mit Link zum
// Video-Call angelegt, Outlook schickt die Einladung. Ohne Link gibt
// es keine Buchung. Braucht in Entra die Anwendungsberechtigung
// Calendars.ReadWrite (Frei/Gebucht lesen, Termin anlegen) und Mail.Send.

export class InviteError extends Error {}

export const INVITE_URL = process.env.SIGN_URL ?? "https://sign.grid-agency.de";

/** Gesprächsdauer, Zeitfenster und Vorlauf der Slots (Zeiten in Berlin) */
const SLOT_MINUTES = 30;
const RULES: SlotRules = { minutes: SLOT_MINUTES, dayStart: 9, dayEnd: 17, leadHours: 18, daysAhead: 14 };

const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

// ---------- Kalender ----------

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
  return freeSlotsIn(mailbox, RULES, await bookedInterviews(mailbox));
}

async function createEvent(application: Row, start: number) {
  const name = String(application.name);
  // Der Text geht mit der Einladung an die Person, daher nichts Internes
  return createMeeting(String(application.invited_by), {
    subject: `Kennenlernen GRID × ${name}`,
    text: `Hi ${firstName(name)},\n\nschön, dass es klappt! Wir sprechen per Video-Call, den Link findest du in diesem Termin.\n\nBis bald\n${application.invited_by_name ?? "GRID"}\nGRID Agency`,
    start,
    minutes: SLOT_MINUTES,
    attendee: { email: String(application.email), name },
    hostName: application.invited_by_name ? String(application.invited_by_name) : undefined,
    link: { application_id: String(application.id) },
  });
}

// ---------- Einladen (Hub) ----------

function inviteMail(application: Row, inviter: { name: string }, link: string) {
  const name = firstName(String(application.name));
  const title = String(application.position_title ?? "");
  const initiative = !title || title === "Initiativbewerbung";
  const role = initiative ? "deine Initiativbewerbung" : `deine Bewerbung als ${title}`;
  const from = firstName(inviter.name);
  const text = `Hi ${name},

danke für ${role}! Wir würden dich gern kennenlernen. Such dir einfach einen Termin für ein ${SLOT_MINUTES}-minütiges Gespräch per Video-Call mit ${from} aus:

${link}

Falls keiner der Termine passt, antworte einfach auf diese Mail.

Bis bald
${inviter.name}
GRID Agency`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#2b2926;max-width:520px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:28px"><tr>
<td style="height:5px;background:#feda75"></td><td style="height:5px;background:#fa7e1e"></td><td style="height:5px;background:#d62976"></td><td style="height:5px;background:#962fbf"></td>
</tr></table>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#fa7e1e;font-weight:600">Einladung zum Kennenlernen</p>
<p style="margin:0 0 20px;font-size:26px;line-height:1.2;font-weight:700">Hi ${escape(name)}, lass uns quatschen!</p>
<p>danke für ${escape(role)}! Sie hat uns gefallen und wir würden dich gern kennenlernen. Such dir einfach einen Termin für ein ${SLOT_MINUTES}-minütiges Gespräch per Video-Call mit ${escape(from)} aus:</p>
<p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#2b2926;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:15px 30px;border-radius:999px;border-bottom:3px solid #fa7e1e">Termin wählen &rarr;</a></p>
<p style="font-size:13px;color:#676159">Oder diesen Link öffnen: <a href="${link}" style="color:#676159">${link}</a></p>
<p>Falls keiner der Termine passt, antworte einfach auf diese Mail.</p>
<p>Bis bald<br><strong>${escape(inviter.name)}</strong><br>GRID Agency</p>
</div>`;
  return { subject: `${name}, lass uns kennenlernen! Einladung von GRID`, text, html };
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
 * Termin mit Video-Call an und trägt ihn an der Bewerbung ein. */
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
