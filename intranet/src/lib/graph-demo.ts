import type { Attachment, CalEvent, Calendar, FolderKey, GraphApi, Message, Recipient } from "./graph";

// Vorschau-Postfach für hello@ (nur NEXT_PUBLIC_INTRANET_DEMO=1 auf localhost):
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

type DemoMessage = Message & { folder: FolderKey; attachmentList?: (Attachment & { text: string })[] };
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

const PAGE = 25;

function findMessage(id: string) {
  const found = messages.find((m) => m.id === id);
  if (!found) throw new Error("Nachricht nicht gefunden");
  return found;
}

/** Nachricht ohne Demo-Felder und ohne Body, wie in der Graph-Liste */
function strip(message: DemoMessage): Message {
  const copy: Partial<DemoMessage> = { ...message };
  delete copy.folder;
  delete copy.attachmentList;
  delete copy.body;
  return copy as Message;
}

// ---------- Kalender ----------

const calendars: Calendar[] = [
  { id: "cal-hello", name: "Kalender", color: "#4f9bf0", isDefaultCalendar: true, canEdit: true },
  { id: "cal-kunden", name: "Kundentermine", color: "#f29c38", isDefaultCalendar: false, canEdit: true },
  { id: "cal-shoot", name: "Shootings", color: "#a77ff0", isDefaultCalendar: false, canEdit: true },
  { id: "cal-feiertage", name: "Feiertage", color: "#ec5b54", isDefaultCalendar: false, canEdit: false },
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
  allDay("cal-hello", "Messe Internorga (Team vor Ort)", day(0, 0), 1)
);

export const demoGraph: GraphApi = {
  async folders() {
    await wait();
    const keys: FolderKey[] = ["inbox", "drafts", "sentitems", "archive", "deleteditems", "junkemail"];
    return keys.map((key) => {
      const items = messages.filter((m) => m.folder === key);
      return { key, id: key, unreadItemCount: items.filter((m) => !m.isRead).length, totalItemCount: items.length };
    });
  },

  async messages({ folder, focused, search, next }) {
    await wait();
    const q = search?.toLowerCase().trim();
    const all = messages
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

  async send(draft) {
    await wait(700);
    messages.push(
      msg("sentitems", HELLO, draft.subject || "(Kein Betreff)", new Date(), `<p>${draft.body.replace(/\n/g, "<br>")}</p>`, {
        toRecipients: draft.to.map((address) => person(address, address)),
        ccRecipients: draft.cc.map((address) => person(address, address)),
      })
    );
  },

  async reply(id, { comment }) {
    await wait(700);
    const original = findMessage(id);
    messages.push(
      msg("sentitems", HELLO, `AW: ${original.subject ?? ""}`, new Date(), `<p>${comment.replace(/\n/g, "<br>")}</p>`, {
        toRecipients: original.from ? [original.from] : [],
      })
    );
  },

  async forward(id, { to, comment }) {
    await wait(700);
    const original = findMessage(id);
    messages.push(
      msg("sentitems", HELLO, `WG: ${original.subject ?? ""}`, new Date(), `<p>${comment.replace(/\n/g, "<br>")}</p>`, {
        toRecipients: to.map((address) => person(address, address)),
      })
    );
  },

  async calendars() {
    await wait();
    return calendars;
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
