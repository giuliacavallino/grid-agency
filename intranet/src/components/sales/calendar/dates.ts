import type { CalEvent } from "@/lib/graph";

export type View = "day" | "week" | "month" | "year";

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  // Tag behalten, aber nicht über das Monatsende hinaus
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), last));
  return d;
}

/** Wochen beginnen am Montag */
export const startOfWeek = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const today = () => startOfDay(new Date());

/** Tage für eine Monatsansicht: volle Wochen von Montag bis Sonntag */
export function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = startOfWeek(first);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks = Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

/** Zeitraum, den eine Ansicht abdeckt (Ende exklusiv) */
export function rangeFor(view: View, anchor: Date): { start: Date; end: Date } {
  if (view === "day") return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) };
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  if (view === "month") {
    const days = monthDays(anchor);
    return { start: days[0], end: addDays(days[days.length - 1], 1) };
  }
  return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear() + 1, 0, 1) };
}

export function step(view: View, anchor: Date, direction: 1 | -1) {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, 7 * direction);
  if (view === "month") return addMonths(anchor, direction);
  return new Date(anchor.getFullYear() + direction, anchor.getMonth(), 1);
}

const monthName = (date: Date, style: "long" | "short" = "long") => date.toLocaleDateString("de-DE", { month: style });

/** Titel wie in Apple Kalender: fetter Teil + heller Teil (Jahr) */
export function titleFor(view: View, anchor: Date): [string, string] {
  const year = String(anchor.getFullYear());
  if (view === "year") return [year, ""];
  if (view === "month") return [monthName(anchor), year];
  if (view === "day") {
    return [anchor.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }), year];
  }
  const { start, end } = rangeFor("week", anchor);
  const last = addDays(end, -1);
  if (start.getMonth() === last.getMonth()) return [monthName(start), year];
  return [`${monthName(start, "short")} – ${monthName(last, "short")}`, String(last.getFullYear())];
}

export const time = (date: Date) => date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Ereignis liegt (teilweise) an diesem Tag */
export function onDay(event: CalEvent, day: Date) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return event.start < end && event.end > start;
}

/** Ganztägig oder über mehrere Tage: gehört in die Ganztagszeile */
export const isAllDayLike = (event: CalEvent) =>
  event.isAllDay || event.end.getTime() - event.start.getTime() >= 86_400_000;

export type Placed = { event: CalEvent; top: number; height: number; column: number; columns: number };

/** Überlappende Termine eines Tages nebeneinander anordnen (Minuten ab 0:00). */
export function layoutDay(events: CalEvent[], day: Date): Placed[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = addDays(startOfDay(day), 1).getTime();
  const items = events
    .map((event) => {
      const start = Math.max(event.start.getTime(), dayStart);
      const end = Math.min(event.end.getTime(), dayEnd);
      return { event, start, end: Math.max(end, start + 15 * 60_000) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let columnsEnd: number[] = [];
  let clusterEnd = 0;

  const flush = () => {
    for (const item of cluster) item.columns = columnsEnd.length;
    cluster = [];
    columnsEnd = [];
  };

  for (const item of items) {
    if (item.start >= clusterEnd) flush();
    let column = columnsEnd.findIndex((end) => end <= item.start);
    if (column < 0) {
      column = columnsEnd.length;
      columnsEnd.push(item.end);
    } else columnsEnd[column] = item.end;
    clusterEnd = Math.max(clusterEnd, item.end);
    const entry: Placed = {
      event: item.event,
      top: (item.start - dayStart) / 60_000,
      height: (item.end - item.start) / 60_000,
      column,
      columns: 1,
    };
    cluster.push(entry);
    placed.push(entry);
  }
  flush();
  return placed;
}

/** Wert für <input type="datetime-local"> bzw. type="date" */
export function toInput(date: Date, withTime = true) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

export const fromInput = (value: string) => new Date(value.length === 10 ? `${value}T00:00` : value);
