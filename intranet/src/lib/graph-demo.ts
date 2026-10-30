import type { Attachment, CalEvent, Calendar, FolderKey, GraphApi, Message, Recipient } from "./graph";
import { berlinDate, buildRecurrence, fromBerlin, occurrences, type JourFix } from "./jourfix";

// Vorschau-Postfächer (nur NEXT_PUBLIC_INTRANET_DEMO=1 auf localhost):
// realistische Beispieldaten im Speicher, Änderungen wirken bis zum Neuladen.

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

function at(daysAgo: number, hours: number, minutes = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

const person = (name: string, address: string): Recipient => ({ emailAddress: { name, address } });
const HELLO = person("GRID Agency", "hello@grid-agency.de");
const GIULIA = person("Giulia Cavallino", "giulia.cavallino@grid-agency.de");
const BUCHHALTUNG = person("Buchhaltung GRID", "buchhaltung@grid-agency.de");
const GOOGLE = person("GRID Google", "google@grid-agency.de");

type DemoMessage = Message & {
  mailbox: string;
  folder: FolderKey;
  attachmentList?: (Attachment & { text: string })[];
};
let seq = 0;

function msg(
  folder: FolderKey,
  from: Recipient,
  subject: string,
  date: Date,
  html: string,
  extra: Partial<DemoMessage> = {}
): DemoMessage {
  const id = `demo-msg-${++seq}`;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    id,
    internetMessageId: `<${id}@demo.grid-agency.de>`,
    mailbox: HELLO.emailAddress.address,
    folder,
    subject,
    bodyPreview: text.slice(0, 160),
    receivedDateTime: date.toISOString(),
    sentDateTime: date.toISOString(),
    from,
    toRecipients: [HELLO],
    ccRecipients: [],
    isRead: true,
    hasAttachments: false,
    flag: { flagStatus: "notFlagged" },
    inferenceClassification: "focused",
    body: { contentType: "html", content: html },
    ...extra,
  };
}

const signature = (name: string, role: string) =>
  `<p>Viele Grüße<br>${name}<br><span style="color:#888">${role}</span></p>`;

const messages: DemoMessage[] = [
  msg("inbox", person("Clara Neumann", "clara@studionord.de"), "Anfrage Social Media für unser Interior-Studio", at(2, 9, 14),
    `<p>Liebes GRID-Team,</p><p>wir sind ein Interior-Studio aus Berlin-Mitte und möchten unseren Auftritt auf Instagram und Pinterest neu aufsetzen. Aktuell posten wir unregelmäßig und ohne klare Linie.</p><p>Habt ihr nächste Woche Zeit für ein erstes Gespräch? Unser Budget liegt bei ca. 2.500 € im Monat.</p>${signature("Clara Neumann", "Studio Nord · Gründerin")}`,
    { internetMessageId: "demo-mail-1", isRead: false }),
  msg("inbox", person("Max Meyer", "max.meyer@gmail.com"), "Initiativbewerbung als Content Creator", at(1, 16, 41),
    `<p>Hallo zusammen,</p><p>ich bin Max, 24, und produziere seit drei Jahren Reels für Gastro-Accounts. Eure Arbeit für Casa Beef finde ich großartig und würde gern Teil des Teams werden.</p><p>Im Anhang findet ihr meinen Lebenslauf und ein Portfolio.</p>${signature("Max Meyer", "Content Creator")}`,
    {
      internetMessageId: "demo-mail-2",
      isRead: false,
      hasAttachments: true,
      attachmentList: [
        { id: "att-1", name: "Lebenslauf_Max_Meyer.pdf", contentType: "application/pdf", size: 184_320, isInline: false, text: "Lebenslauf (Vorschau)" },
        { id: "att-2", name: "Portfolio_2026.pdf", contentType: "application/pdf", size: 2_411_724, isInline: false, text: "Portfolio (Vorschau)" },
      ],
    }),
  msg("inbox", person("Marco Rossi", "marco@casabeef.de"), "Re: Content-Plan November", at(0, 8, 2),
    `<p>Hi ihr Lieben,</p><p>der Plan sieht super aus! Können wir das Shooting für die Winterkarte auf den 12. legen? Am 10. ist das Restaurant für eine Hochzeit gebucht.</p>${signature("Marco", "Casa Beef")}`,
    { isRead: false, flag: { flagStatus: "flagged" } }),
  msg("inbox", person("Lena Kühn", "lena@frittenwerk.de"), "Freigabe Reels KW 45", at(0, 11, 37),
    `<p>Hallo GRID,</p><p>alle drei Reels sind freigegeben, nur beim zweiten bitte den Preis auf 7,90 € ändern. Danke!</p>${signature("Lena", "Frittenwerk Marketing")}`),
  msg("inbox", person("Calendly", "notifications@calendly.com"), "Neuer Termin: Erstgespräch mit Paul Richter", at(0, 7, 20),
    `<p><b>Paul Richter</b> hat einen Termin gebucht.</p><p>Erstgespräch (30 Min.)<br>Donnerstag, 10:00 Uhr<br>Microsoft Teams</p>`, { isRead: false }),
  msg("inbox", person("Leon Wolf", "leon@wolf-fitness.de"), "Unterlagen für das Angebot", at(3, 14, 5),
    `<p>Hallo,</p><p>wie besprochen schicke ich euch unser Brandbook und die Zahlen der letzten Kampagne.</p>${signature("Leon Wolf", "Wolf Fitness")}`,
    {
      hasAttachments: true,
      attachmentList: [{ id: "att-3", name: "Brandbook_WolfFitness.pdf", contentType: "application/pdf", size: 5_201_331, isInline: false, text: "Brandbook (Vorschau)" }],
    }),
  msg("inbox", person("Sophie Wagner", "sophie@lovebirds.de"), "Kurze Frage zum Reporting", at(5, 10, 12),
    `<p>Hi! Könnt ihr im Oktober-Reporting auch die Story-Reichweite aufschlüsseln? LG Sophie</p>`),
  msg("inbox", person("Jana Peters", "jana.peters@outlook.de"), "Bewerbung Werkstudentin Social Media", at(6, 18, 30),
    `<p>Sehr geehrtes GRID-Team,</p><p>hiermit bewerbe ich mich als Werkstudentin im Bereich Social Media. Ich studiere Medienmanagement im 5. Semester.</p>${signature("Jana Peters", "")}`),
  msg("inbox", person("Meta for Business", "noreply@business.facebook.com"), "Neuer Lead aus deinem Formular „Social Media Check“", at(1, 6, 55),
    `<p>Du hast einen neuen Lead über Instagram erhalten: <b>Deniz Aksoy</b>.</p><p>Öffne den Meta Business Manager, um alle Angaben zu sehen.</p>`,
    { inferenceClassification: "other" }),
  msg("inbox", person("OMR Newsletter", "newsletter@omr.com"), "Die 5 wichtigsten Social-Trends für 2027", at(1, 7, 0),
    `<h2 style="margin:0 0 8px">OMR Daily</h2><p>Heute: Warum Reels allein nicht mehr reichen, Threads wächst und TikTok Shop startet in Deutschland.</p><p><a href="https://omr.com">Weiterlesen</a></p>`,
    { inferenceClassification: "other", isRead: false }),
  msg("inbox", person("Adobe", "mail@mail.adobe.com"), "Deine Rechnung für Creative Cloud", at(4, 3, 12),
    `<p>Vielen Dank für dein Abo. Deine Rechnung über 89,24 € steht bereit.</p>`, { inferenceClassification: "other" }),
  msg("inbox", person("LinkedIn", "messages-noreply@linkedin.com"), "Felix Brandt hat dir eine Nachricht gesendet", at(3, 12, 0),
    `<p>Felix Brandt: „Hallo, wir hatten über das Lead-Formular Kontakt. Wann passt ein Call?“</p>`, { inferenceClassification: "other" }),
  msg("inbox", person("Hannah Krüger", "hannah@bloom-florist.de"), "Empfehlung von Goldies", at(9, 15, 48),
    `<p>Hallo! Tim von Goldies hat euch empfohlen. Wir suchen Unterstützung für unseren Instagram-Kanal und die Hochzeitssaison 2027.</p>${signature("Hannah Krüger", "Bloom Florist")}`),
  msg("inbox", person("Tim Becker", "tim@goldies.berlin"), "Danke für das Event!", at(12, 22, 3),
    `<p>Ihr wart großartig gestern, das Recap-Reel ist schon bei 40k Views 🔥</p>`),
  msg("sentitems", HELLO, "Re: Anfrage Social Media", at(1, 10, 2),
    `<p>Hallo Clara,</p><p>danke für deine Nachricht! Wie wäre Donnerstag um 10 Uhr?</p>${signature("Giulia", "GRID Agency")}`,
    { toRecipients: [person("Clara Neumann", "clara@studionord.de")] }),
  msg("sentitems", HELLO, "Content-Plan November", at(2, 17, 30),
    `<p>Hi Marco, anbei der Content-Plan für November.</p>`, { toRecipients: [person("Marco Rossi", "marco@casabeef.de")] }),
  msg("drafts", HELLO, "Angebot Urban Sneakers", at(0, 9, 45),
    `<p>Hallo Lukas,</p><p>anbei unser Angebot für die Launch-Kampagne …</p>`,
    { isDraft: true, toRecipients: [person("Lukas Zimmermann", "lukas@urbansneakers.de")] }),
  msg("archive", person("Aylin Demir", "aylin@sajentclub.de"), "Vertrag unterschrieben", at(40, 11, 0),
    `<p>Anbei der unterschriebene Vertrag. Wir freuen uns!</p>`),
  msg("deleteditems", person("Werbung", "angebot@druckerei-xyz.de"), "Flyer 50 % günstiger", at(8, 9, 0),
    `<p>Nur diese Woche: Flyer zum halben Preis.</p>`),
  msg("junkemail", person("Prize Center", "winner@prize-center.biz"), "Sie haben gewonnen!!!", at(2, 4, 4),
    `<p>Klicken Sie hier, um Ihren Preis abzuholen.</p>`),
];

const pdf = (id: string, name: string, size: number) => ({ id, name, contentType: "application/pdf", size, isInline: false, text: `${name} (Vorschau)` });

messages.push(
  msg("inbox", person("Adobe", "mail@mail.adobe.com"), "Rechnung Creative Cloud Oktober", at(1, 5, 12),
    `<p>Rechnungsnummer IE-2026-118422, Betrag 89,24 € (inkl. USt.), fällig am 15. des Monats.</p>`,
    { id: "demo-inv-adobe", mailbox: BUCHHALTUNG.emailAddress.address, toRecipients: [BUCHHALTUNG], internetMessageId: "demo-mail-3", isRead: false, hasAttachments: true, attachmentList: [pdf("att-4", "Adobe_IE-2026-118422.pdf", 88_211)] }),
  msg("inbox", person("Steffen Video", "rechnung@steffen-video.de"), "Rechnung 2026-041 Shooting Frittenwerk", at(3, 9, 40),
    `<p>Hallo, anbei meine Rechnung 2026-041 über 1.428,00 € brutto. Zahlbar innerhalb von 14 Tagen.</p>${signature("Steffen", "Video & Foto")}`,
    { id: "demo-inv-steffen", mailbox: BUCHHALTUNG.emailAddress.address, toRecipients: [BUCHHALTUNG], internetMessageId: "demo-mail-4", hasAttachments: true, attachmentList: [pdf("att-5", "Rechnung_2026-041.pdf", 141_002)] }),
  msg("inbox", person("Telekom", "rechnung@telekom.de"), "Ihre Mobilfunk-Rechnung", at(6, 6, 0),
    `<p>Ihre Rechnung über 54,90 € ist online verfügbar.</p>`,
    { mailbox: BUCHHALTUNG.emailAddress.address, toRecipients: [BUCHHALTUNG], hasAttachments: true, attachmentList: [pdf("att-6", "Telekom_Rechnung.pdf", 61_204)] }),
  msg("inbox", person("Jonas Weber", "jonas@weber-gastro.de"), "Social Media für unsere Weinbar", at(0, 10, 3),
    `<p>Hallo Giulia, ich habe dich auf der Internorga kennengelernt. Wir eröffnen im Frühjahr eine Weinbar in Sachsenhausen und bräuchten Unterstützung bei Instagram.</p>${signature("Jonas Weber", "Weber Gastro")}`,
    { mailbox: GIULIA.emailAddress.address, toRecipients: [GIULIA], isRead: false }),
  msg("inbox", person("Anna Goschin", "anna@goschin-art.de"), "Vernissage am Freitag", at(2, 19, 22),
    `<p>Liebe Giulia, kommst du Freitag vorbei? Würde mich sehr freuen!</p>`,
    { mailbox: GIULIA.emailAddress.address, toRecipients: [GIULIA] }),
  msg("inbox", person("Google", "no-reply@accounts.google.com"), "Sicherheitswarnung für google@grid-agency.de", at(1, 22, 1),
    `<p>Neue Anmeldung auf einem Mac. Wenn du das warst, musst du nichts weiter tun.</p>`,
    { mailbox: GOOGLE.emailAddress.address, toRecipients: [GOOGLE], inferenceClassification: "other" }),
  msg("inbox", person("Lea Schmitt", "lea.schmitt@web.de"), "Bewerbung Praktikum Content Creation", at(4, 13, 30),
    `<p>Hallo, über Google bin ich auf euch gestoßen und möchte mich für ein Praktikum bewerben. Lebenslauf anbei.</p>`,
    { mailbox: GOOGLE.emailAddress.address, toRecipients: [GOOGLE], hasAttachments: true, attachmentList: [pdf("att-7", "Lebenslauf_Lea_Schmitt.pdf", 201_330)] }),
);

const PAGE = 25;

const OWN: Record<string, Recipient> = {
  [HELLO.emailAddress.address]: HELLO,
  [GIULIA.emailAddress.address]: GIULIA,
  [BUCHHALTUNG.emailAddress.address]: BUCHHALTUNG,
  [GOOGLE.emailAddress.address]: GOOGLE,
};

function findMessage(id: string) {
  const found = messages.find((m) => m.id === id);
  if (!found) throw new Error("Nachricht nicht gefunden");
  return found;
}

/** Nachricht ohne Demo-Felder und ohne Body, wie in der Graph-Liste */
function strip(message: DemoMessage): Message {
  const copy: Partial<DemoMessage> = { ...message };
  delete copy.mailbox;
  delete copy.folder;
  delete copy.attachmentList;
  delete copy.body;
  return copy as Message;
}

// ---------- Kalender ----------

const H = HELLO.emailAddress.address;
const calendars: Calendar[] = [
  { id: "cal-hello", mailbox: H, name: "Kalender", color: "#4f9bf0", isDefaultCalendar: true, canEdit: true },
  { id: "cal-kunden", mailbox: H, name: "Kundentermine", color: "#f29c38", isDefaultCalendar: false, canEdit: true },
  { id: "cal-shoot", mailbox: H, name: "Shootings", color: "#a77ff0", isDefaultCalendar: false, canEdit: true },
  { id: "cal-feiertage", mailbox: H, name: "Feiertage", color: "#ec5b54", isDefaultCalendar: false, canEdit: false },
  { id: "cal-giulia", mailbox: GIULIA.emailAddress.address, name: "Kalender", color: "#3fb7b0", isDefaultCalendar: true, canEdit: true },
  { id: "cal-buchhaltung", mailbox: BUCHHALTUNG.emailAddress.address, name: "Kalender", color: "#e7c13e", isDefaultCalendar: true, canEdit: true },
  { id: "cal-google", mailbox: GOOGLE.emailAddress.address, name: "Kalender", color: "#9a948b", isDefaultCalendar: true, canEdit: true },
];

function monday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

let eventSeq = 0;
function event(
  calendarId: string,
  subject: string,
  weekOffset: number,
  weekday: number,
  startHour: number,
  durationMinutes: number,
  extra: Partial<CalEvent> = {}
): CalEvent {
  const start = monday(new Date());
  start.setDate(start.getDate() + weekOffset * 7 + weekday);
  start.setHours(Math.floor(startHour), Math.round((startHour % 1) * 60), 0, 0);
  return {
    id: `demo-evt-${++eventSeq}`,
    calendarId,
    subject,
    start,
    end: new Date(start.getTime() + durationMinutes * 60_000),
    isAllDay: false,
    location: null,
    organizer: "GRID Agency",
    attendees: [],
    joinUrl: null,
    bodyPreview: "",
    webLink: null,
    ...extra,
  };
}

function allDay(calendarId: string, subject: string, date: Date, days = 1): CalEvent {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { ...event(calendarId, subject, 0, 0, 0, 0), start, end, isAllDay: true };
}

const teams = "https://teams.microsoft.com/l/meetup-join/demo";
const calendarEvents: CalEvent[] = [];
for (let w = -5; w <= 5; w++) {
  calendarEvents.push(
    event("cal-hello", "Team-Weekly", w, 0, 9.5, 45, { joinUrl: teams, location: "Microsoft Teams", bodyPreview: "Wochenstart: Prioritäten, Shootings, offene Freigaben." }),
    event("cal-hello", "Content-Review", w, 3, 15, 60, { location: "Studio Kreuzberg" })
  );
}
const day = (weekOffset: number, weekday: number) => {
  const d = monday(new Date());
  d.setDate(d.getDate() + weekOffset * 7 + weekday);
  return d;
};
calendarEvents.push(
  event("cal-kunden", "Erstgespräch Paul Richter", 0, 3, 10, 30, {
    joinUrl: teams,
    location: "Microsoft Teams",
    attendees: [{ name: "Paul Richter", address: "paul@richter-baeckerei.de", response: "accepted" }],
    bodyPreview: "Bäckerei mit 4 Filialen, möchte jüngere Zielgruppe erreichen.",
  }),
  event("cal-kunden", "Erstgespräch Clara Neumann (Studio Nord)", 0, 3, 10.25, 45, {
    location: "GRID Office",
    attendees: [{ name: "Clara Neumann", address: "clara@studionord.de", response: "tentativelyAccepted" }],
  }),
  event("cal-kunden", "Angebotspräsentation Urban Sneakers", 0, 1, 14, 90, { location: "Urban Sneakers Store, Torstraße" }),
  event("cal-kunden", "Monatsreporting Frittenwerk", 0, 2, 11, 60, { joinUrl: teams, location: "Microsoft Teams" }),
  event("cal-kunden", "Call Wolf Fitness", 0, 4, 16.5, 30, { joinUrl: teams }),
  event("cal-kunden", "Jahresplanung Casa Beef", 1, 1, 13, 120, { location: "Casa Beef" }),
  event("cal-shoot", "Shooting Winterkarte Casa Beef", 0, 2, 8, 240, { location: "Casa Beef, Prenzlauer Berg" }),
  event("cal-shoot", "Reels-Dreh Frittenwerk", 0, 4, 9, 180, { location: "Frittenwerk Frankfurt" }),
  event("cal-shoot", "Event-Content Goldies", -1, 4, 19, 240),
  event("cal-hello", "Lunch mit Lovebirds", 0, 0, 12.5, 60, { location: "Café Fleury" }),
  event("cal-kunden", "Erstgespräch Hannah Krüger", 1, 2, 10, 30, { joinUrl: teams }),
  allDay("cal-shoot", "Produktionstage Lovebirds Kampagne", day(1, 3), 2),
  allDay("cal-feiertage", "Reformationstag", new Date(new Date().getFullYear(), 9, 31)),
  allDay("cal-feiertage", "Tag der Deutschen Einheit", new Date(new Date().getFullYear(), 9, 3)),
  allDay("cal-feiertage", "1. Weihnachtstag", new Date(new Date().getFullYear(), 11, 25)),
  allDay("cal-hello", "Messe Internorga (Team vor Ort)", day(0, 0), 1),
  event("cal-giulia", "Steuerberatung", 0, 1, 16, 60, { location: "Kanzlei" }),
  event("cal-giulia", "Vernissage Anna", 0, 4, 19, 120)
);

// Jour fixe (Vorschau): wöchentlich dienstags 10:00 mit Frittenwerk, seit
// fünf Wochen. Derselbe Raum steht in demo-store.ts (meetings).
const lastTuesday = (() => {
  const d = new Date(`${berlinDate(Date.now())}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 5) % 7) - 35);
  return fromBerlin(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 10);
})();
export const DEMO_JOURFIX = {
  code: "jfx-frtw-k8m",
  title: "Jour fixe GRID × Frittenwerk",
  start: lastTuesday,
  minutes: 45,
  recurrence: buildRecurrence(lastTuesday, "weekly", { type: "noEnd" }),
  attendees: [
    { name: "Lena Kühn", address: "lena@frittenwerk.de", response: "accepted" },
    { name: "Giulia Cavallino", address: "giulia.cavallino@grid-agency.de", response: "organizer" },
  ],
};

/** Termine einer Serie in den Vorschau-Kalender legen (wie Outlook es täte) */
function seriesEvents(calendarId: string, series: { title: string; start: number; minutes: number; joinUrl: string | null; location: string | null; recurrence: JourFix["recurrence"]; attendees?: CalEvent["attendees"] }) {
  return occurrences(series.recurrence, series.start, 120).map((at) => ({
    id: `demo-evt-${++eventSeq}`,
    calendarId,
    subject: series.title,
    start: new Date(at),
    end: new Date(at + series.minutes * 60_000),
    isAllDay: false,
    location: series.joinUrl ?? series.location,
    organizer: "GRID Agency",
    attendees: series.attendees ?? [],
    joinUrl: series.joinUrl,
    bodyPreview: series.joinUrl ? `Zum Video-Call (gilt für jeden Termin der Serie): ${series.joinUrl}` : "",
    webLink: null,
    recurring: true,
  }));
}

calendarEvents.push(
  ...seriesEvents("cal-kunden", {
    title: DEMO_JOURFIX.title,
    start: DEMO_JOURFIX.start,
    minutes: DEMO_JOURFIX.minutes,
    joinUrl: `https://meet.grid-agency.de/${DEMO_JOURFIX.code}`,
    location: null,
    recurrence: DEMO_JOURFIX.recurrence,
    attendees: DEMO_JOURFIX.attendees,
  })
);

/** Vorschau: neu angelegten Jour fixe im Kalender zeigen (Standardkalender
 * des Postfachs, sonst hello@) */
export function addDemoSeries(mailbox: string, jourFix: JourFix) {
  const calendar = calendars.find((c) => c.mailbox === mailbox && c.isDefaultCalendar) ?? calendars[0];
  calendarEvents.push(
    ...seriesEvents(calendar.id, {
      title: jourFix.title,
      start: Date.parse(jourFix.starts_at),
      minutes: jourFix.minutes,
      joinUrl: jourFix.url,
      location: jourFix.location,
      recurrence: jourFix.recurrence,
    })
  );
}

/** Vorschau: beendete Serie ab morgen aus dem Kalender nehmen */
export function endDemoSeries(title: string) {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  for (let i = calendarEvents.length - 1; i >= 0; i--) {
    const e = calendarEvents[i];
    if (e.recurring && e.subject === title && e.start >= tomorrow) calendarEvents.splice(i, 1);
  }
}

export function demoGraphFor(mailbox: string): GraphApi {
  const own = OWN[mailbox] ?? person(mailbox, mailbox);
  const mine = () => messages.filter((m) => m.mailbox === mailbox);
  const sent = (folder: FolderKey, subject: string, html: string, extra: Partial<DemoMessage>) =>
    messages.push(msg(folder, own, subject, new Date(), html, { mailbox, ...extra }));
  return {
    async folders() {
      await wait();
      const keys: FolderKey[] = ["inbox", "drafts", "sentitems", "archive", "deleteditems", "junkemail"];
      return keys.map((key) => {
        const items = mine().filter((m) => m.folder === key);
        return { key, id: key, unreadItemCount: items.filter((m) => !m.isRead).length, totalItemCount: items.length };
      });
    },

    async messages({ folder, focused, search, next }) {
      await wait();
      const q = search?.toLowerCase().trim();
      const all = mine()
        .filter((m) => m.folder === folder)
        .filter((m) => (focused === undefined || focused === null ? true : (m.inferenceClassification === "focused") === focused))
        .filter((m) => !q || [m.subject, m.bodyPreview, m.from?.emailAddress.name, m.from?.emailAddress.address].some((v) => v?.toLowerCase().includes(q)))
        .sort((a, b) => b.receivedDateTime.localeCompare(a.receivedDateTime));
      const offset = next ? Number(next.split(":")[1]) : 0;
      const page = all.slice(offset, offset + PAGE);
      return { items: page.map(strip), next: offset + PAGE < all.length ? `demo:${offset + PAGE}` : null };
    },

    async message(id) {
      await wait(160);
      const m = findMessage(id);
      return { ...strip(m), body: m.body };
    },

    async attachments(id) {
      await wait(120);
      return (findMessage(id).attachmentList ?? []).map(({ id, name, contentType, size, isInline }) => ({ id, name, contentType, size, isInline }));
    },

    async download(messageId, attachmentId) {
      await wait(400);
      const attachment = findMessage(messageId).attachmentList?.find((a) => a.id === attachmentId);
      return new Blob([attachment?.text ?? ""], { type: "text/plain" });
    },

    async update(id, patch) {
      await wait(120);
      Object.assign(findMessage(id), patch);
    },

    async move(id, destination) {
      await wait();
      findMessage(id).folder = destination;
    },

    async remove(id) {
      await wait();
      const index = messages.findIndex((m) => m.id === id);
      if (index >= 0) messages.splice(index, 1);
    },

    async files(id) {
      await wait(300);
      return (findMessage(id).attachmentList ?? []).map((a) => ({ name: a.name, contentType: a.contentType, contentBytes: btoa(a.text) }));
    },

    async send(draft) {
      await wait(700);
      sent("sentitems", draft.subject || "(Kein Betreff)", `<p>${draft.body.replace(/\n/g, "<br>")}</p>`, {
        toRecipients: draft.to.map((address) => person(address, address)),
        ccRecipients: draft.cc.map((address) => person(address, address)),
      });
    },

    async reply(id, { comment }) {
      await wait(700);
      const original = findMessage(id);
      sent("sentitems", `AW: ${original.subject ?? ""}`, `<p>${comment.replace(/\n/g, "<br>")}</p>`, {
        toRecipients: original.from ? [original.from] : [],
      });
    },

    async forward(id, { to, comment }) {
      await wait(700);
      const original = findMessage(id);
      sent("sentitems", `WG: ${original.subject ?? ""}`, `<p>${comment.replace(/\n/g, "<br>")}</p>`, {
        toRecipients: to.map((address) => person(address, address)),
      });
    },

    async calendars() {
      await wait();
      return calendars.filter((c) => c.mailbox === mailbox);
    },

    async events(calendar, start, end) {
      await wait();
      return calendarEvents.filter((e) => e.calendarId === calendar.id && e.start < end && e.end > start);
    },

    async createEvent(calendarId, input) {
      await wait(500);
      calendarEvents.push({
        id: `demo-evt-${++eventSeq}`,
        calendarId,
        subject: input.subject,
        start: input.start,
        end: input.end,
        isAllDay: input.isAllDay,
        location: input.location || null,
        organizer: "GRID Agency",
        attendees: [],
        joinUrl: null,
        bodyPreview: "",
        webLink: null,
      });
    },

    async deleteEvent(id) {
      await wait(400);
      const index = calendarEvents.findIndex((e) => e.id === id);
      if (index >= 0) calendarEvents.splice(index, 1);
    },
  };
}
