// Jour fixe: wiederkehrende Termine mit einem festen Raum unter
// meet.grid-agency.de. Gemeinsam für Browser und Server: Rhythmus in ein
// Graph-Muster (pattern + range) übersetzen, Termine der Serie in Berliner
// Ortszeit berechnen (inkl. Sommerzeit) und lesbar beschreiben.

export const TZ = "Europe/Berlin";

export const DURATIONS = [30, 45, 60, 90] as const;
export type Duration = (typeof DURATIONS)[number];

export const RHYTHMS = [
  { id: "weekly", label: "Wöchentlich" },
  { id: "biweekly", label: "Alle 2 Wochen" },
  { id: "every4", label: "Alle 4 Wochen" },
  { id: "monthly", label: "Monatlich" },
] as const;
export type Rhythm = (typeof RHYTHMS)[number]["id"];

export type SeriesEnd = { type: "noEnd" } | { type: "endDate"; date: string } | { type: "numbered"; count: number };

/** Höchstzahl Termine bei „nach n Terminen“ (zwei Jahre wöchentlich) */
export const MAX_OCCURRENCES = 104;

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
type Weekday = (typeof WEEKDAYS)[number];
const WEEKDAY_DE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const INDEXES = ["first", "second", "third", "fourth", "last"] as const;
type WeekIndex = (typeof INDEXES)[number];
const INDEX_DE: Record<WeekIndex, string> = { first: "1.", second: "2.", third: "3.", fourth: "4.", last: "letzten" };

/** Muster und Bereich wie in Microsoft Graph (patternedRecurrence) */
export type Recurrence = {
  pattern: {
    type: "weekly" | "absoluteMonthly" | "relativeMonthly";
    interval: number;
    daysOfWeek?: Weekday[];
    dayOfMonth?: number;
    index?: WeekIndex;
    firstDayOfWeek?: Weekday;
  };
  range: { type: "noEnd" | "endDate" | "numbered"; startDate: string; endDate?: string; numberOfOccurrences?: number };
};

// ---------- Berliner Ortszeit ----------

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
export function berlinWall(ms: number) {
  const p = Object.fromEntries(berlinParts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
}

/** Berliner Ortszeit → Zeitpunkt (inkl. Sommer-/Winterzeit) */
export function fromBerlin(year: number, month: number, day: number, hour: number, minute = 0) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall - (berlinWall(wall) - wall);
  utc = wall - (berlinWall(utc) - utc);
  return utc;
}

/** "2026-11-03T10:00" (Berliner Ortszeit) → Zeitpunkt */
export function parseLocal(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const ms = fromBerlin(y, mo, d, h, mi);
  // 31. Februar o. ä. ausschließen
  return new Date(berlinWall(ms)).toISOString().slice(0, 16) === value ? ms : null;
}

/** Zeitpunkt → "2026-11-03T10:00:00" in Berliner Ortszeit (für Graph) */
export const localString = (ms: number) => new Date(berlinWall(ms)).toISOString().slice(0, 19);

/** Kalendertag in Berlin als "YYYY-MM-DD" */
export const berlinDate = (ms: number) => new Date(berlinWall(ms)).toISOString().slice(0, 10);

// ---------- Rhythmus → Graph ----------

/** Wochentag-Index im Monat: 1. bis 4. oder „letzter“ (ab dem 29.) */
function weekIndex(dayOfMonth: number): WeekIndex {
  return INDEXES[Math.min(4, Math.ceil(dayOfMonth / 7) - 1)];
}

/** Graph-Muster aus Beginn, Rhythmus und Ende; den Wochentag liefert der Beginn */
export function buildRecurrence(start: number, rhythm: Rhythm, end: SeriesEnd): Recurrence {
  const wall = new Date(berlinWall(start));
  const weekday = WEEKDAYS[wall.getUTCDay()];
  const pattern: Recurrence["pattern"] =
    rhythm === "monthly"
      ? { type: "relativeMonthly", interval: 1, daysOfWeek: [weekday], index: weekIndex(wall.getUTCDate()) }
      : { type: "weekly", interval: rhythm === "weekly" ? 1 : rhythm === "biweekly" ? 2 : 4, daysOfWeek: [weekday], firstDayOfWeek: "monday" };
  const startDate = berlinDate(start);
  const range: Recurrence["range"] =
    end.type === "endDate"
      ? { type: "endDate", startDate, endDate: end.date }
      : end.type === "numbered"
        ? { type: "numbered", startDate, numberOfOccurrences: end.count }
        : { type: "noEnd", startDate };
  return { pattern, range };
}

/** Rhythmus zurück aus dem Muster (für Listen) */
export function rhythmOf(recurrence: Recurrence): Rhythm {
  if (recurrence.pattern.type !== "weekly") return "monthly";
  return recurrence.pattern.interval === 2 ? "biweekly" : recurrence.pattern.interval === 4 ? "every4" : "weekly";
}

// ---------- Termine der Serie ----------

const DAY = 86_400_000;

/** Kalendertage (UTC-Mitternacht) der Serie, ab dem ersten */
function* seriesDays(recurrence: Recurrence, first: Date): Generator<Date> {
  const { pattern } = recurrence;
  const interval = Math.max(1, pattern.interval || 1);
  if (pattern.type === "weekly") {
    for (let k = 0; ; k++) yield new Date(first.getTime() + k * interval * 7 * DAY);
  }
  for (let k = 0; ; k++) {
    const year = first.getUTCFullYear();
    const month = first.getUTCMonth() + k * interval;
    if (pattern.type === "absoluteMonthly") {
      const day = pattern.dayOfMonth ?? first.getUTCDate();
      const date = new Date(Date.UTC(year, month, day));
      // Monate ohne diesen Tag (z. B. 31.) überspringt Outlook
      if (date.getUTCDate() === day) yield date;
      continue;
    }
    const weekday = WEEKDAYS.indexOf(pattern.daysOfWeek?.[0] ?? WEEKDAYS[first.getUTCDay()]);
    const index = pattern.index ?? "first";
    if (index === "last") {
      const last = new Date(Date.UTC(year, month + 1, 0));
      yield new Date(last.getTime() - ((last.getUTCDay() - weekday + 7) % 7) * DAY);
    } else {
      const firstOfMonth = new Date(Date.UTC(year, month, 1));
      const offset = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
      yield new Date(firstOfMonth.getTime() + (offset + INDEXES.indexOf(index) * 7) * DAY);
    }
  }
}

/** Beginn aller Termine der Serie (höchstens `limit`), Uhrzeit wie der erste
 * Termin in Berliner Ortszeit, auch über den Wechsel zur Sommerzeit. */
export function occurrences(recurrence: Recurrence, startsAt: string | number, limit = 500): number[] {
  const start = typeof startsAt === "number" ? startsAt : Date.parse(startsAt);
  const wall = new Date(berlinWall(start));
  const first = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()));
  const { range } = recurrence;
  const max = range.type === "numbered" ? Math.min(limit, range.numberOfOccurrences ?? 1) : limit;
  const out: number[] = [];
  for (const date of seriesDays(recurrence, first)) {
    if (out.length >= max) break;
    const day = date.toISOString().slice(0, 10);
    if (range.type === "endDate" && range.endDate && day > range.endDate) break;
    if (date < first) continue;
    out.push(fromBerlin(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes()));
  }
  return out;
}

/** Nächster Termin der Serie: der erste, der noch nicht vorbei ist (ein
 * laufender Termin zählt mit). null, wenn die Serie zu Ende ist. */
export function nextOccurrence(recurrence: Recurrence, startsAt: string | number, now = Date.now(), minutes = 0): number | null {
  const start = typeof startsAt === "number" ? startsAt : Date.parse(startsAt);
  // Bei offenen Serien reicht es, bis kurz nach „jetzt“ zu rechnen
  const weeks = Math.max(0, (now - start) / (7 * DAY));
  const limit = Math.ceil(weeks) + 8;
  return occurrences(recurrence, start, limit).find((at) => at + minutes * 60_000 > now) ?? null;
}

/** Letzter Termin einer Serie mit Ende (null bei „ohne Ende“) */
export function lastOccurrence(recurrence: Recurrence, startsAt: string | number): number | null {
  if (recurrence.range.type === "noEnd") return null;
  return occurrences(recurrence, startsAt, MAX_OCCURRENCES * 5).at(-1) ?? null;
}

// ---------- Texte ----------

const timeFormat = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** z. B. „Jeden Dienstag, 10:00“, „Alle 2 Wochen dienstags, 10:00“, „Jeden 1. Dienstag im Monat, 10:00“ */
export function rhythmLabel(recurrence: Recurrence, startsAt: string | number) {
  const start = typeof startsAt === "number" ? startsAt : Date.parse(startsAt);
  const weekdayNumber = new Date(berlinWall(start)).getUTCDay();
  const weekday = WEEKDAY_DE[weekdayNumber];
  const time = timeFormat.format(start);
  const { pattern } = recurrence;
  if (pattern.type === "relativeMonthly") return `Jeden ${INDEX_DE[pattern.index ?? "first"]} ${weekday} im Monat, ${time}`;
  if (pattern.type === "absoluteMonthly") return `Monatlich am ${pattern.dayOfMonth ?? new Date(berlinWall(start)).getUTCDate()}., ${time}`;
  if (pattern.interval > 1) return `Alle ${pattern.interval} Wochen ${weekday.toLowerCase()}s, ${time}`;
  return `Jeden ${weekday}, ${time}`;
}

/** Ende der Serie als Text, z. B. „bis 31.12.2026“ oder „3 Termine“ */
export function endLabel(recurrence: Recurrence) {
  const { range } = recurrence;
  if (range.type === "endDate" && range.endDate) {
    const [y, m, d] = range.endDate.split("-");
    return `bis ${d}.${m}.${y}`;
  }
  if (range.type === "numbered") return range.numberOfOccurrences === 1 ? "1 Termin" : `${range.numberOfOccurrences} Termine`;
  return "ohne Ende";
}

/** Wochentag-Text für den Rhythmus „monatlich“ in Formularen, z. B. „jeden 1. Dienstag“ */
export function monthlyHint(start: number) {
  const wall = new Date(berlinWall(start));
  return `jeden ${INDEX_DE[weekIndex(wall.getUTCDate())]} ${WEEKDAY_DE[wall.getUTCDay()]}`;
}

export const isEmail = (value: string) => /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i.test(value);

// ---------- API ----------

/** Eingaben für POST /api/kalender/jourfix */
export type JourFixInput = {
  title: string;
  customer_id: string | null;
  attendees: string[];
  /** Beginn in Berliner Ortszeit, "YYYY-MM-DDTHH:mm" */
  start: string;
  minutes: number;
  rhythm: Rhythm;
  end: SeriesEnd;
  video: boolean;
  location: string;
  mailbox: string;
};

/** Ein Jour fixe, wie die Liste ihn zeigt */
export type JourFix = {
  id: string;
  title: string;
  customer_id: string | null;
  url: string | null;
  starts_at: string;
  minutes: number;
  recurrence: Recurrence;
  rhythm: string;
  end: string;
  next: string | null;
  mailbox: string | null;
  location: string | null;
  cancelled_at: string | null;
};
