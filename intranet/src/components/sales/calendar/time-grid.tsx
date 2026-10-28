"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { CalEvent } from "@/lib/graph";
import { accentFill, accentText } from "@/lib/theme";
import { addDays, isAllDayLike, layoutDay, onDay, sameDay, time } from "./dates";
import { TODAY_RED } from "./mini-month";

const HOUR = 52;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Tages- und Wochenansicht: Ganztagszeile oben, darunter das Stundenraster. */
export function TimeGrid({
  start,
  days: count,
  today,
  events,
  colorOf,
  onOpen,
  onCreate,
  onDay: openDay,
}: {
  start: Date;
  days: number;
  today: Date;
  events: CalEvent[];
  colorOf: (event: CalEvent) => string;
  onOpen: (event: CalEvent) => void;
  onCreate: (start: Date) => void;
  onDay: (day: Date) => void;
}) {
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  // Beim Öffnen auf etwa 8 Uhr scrollen
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR - 8;
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const timed = events.filter((e) => !isAllDayLike(e));
  const allDay = events.filter(isAllDayLike);
  const allDayRows = Math.max(0, ...days.map((d) => allDay.filter((e) => onDay(e, d)).length));
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR / 60);
  const columns = `56px repeat(${count}, minmax(0, 1fr))`;

  function createAt(day: Date, event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = Math.floor(((event.clientY - rect.top) / HOUR) * 2) * 30;
    const at = new Date(day);
    at.setHours(0, Math.max(0, Math.min(minutes, 23 * 60 + 30)), 0, 0);
    onCreate(at);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Kopf: Wochentage + Ganztagszeile */}
      <div className="shrink-0 overflow-y-hidden border-b border-snow/[0.08] [scrollbar-gutter:stable]">
        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <span />
          {days.map((day) => {
            const isToday = sameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => openDay(day)}
                className="flex items-center justify-center gap-1.5 py-2 text-[13px] text-snow/60 hover:text-snow"
              >
                <span>{day.toLocaleDateString("de-DE", { weekday: "short" })}</span>
                <span
                  className={cn("grid h-7 min-w-7 place-items-center rounded-full px-1 text-[15px] font-medium tabular-nums", isToday ? "text-white" : "text-snow")}
                  style={isToday ? { background: TODAY_RED } : undefined}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
        {allDayRows > 0 && (
          <div className="grid border-t border-snow/[0.06]" style={{ gridTemplateColumns: columns }}>
            <span className="pt-1.5 pr-2 text-right text-[10.5px] text-snow/40">ganztägig</span>
            {days.map((day) => (
              <ul key={day.toISOString()} className="flex flex-col gap-px border-l border-snow/[0.06] px-0.5 py-1">
                {allDay
                  .filter((e) => onDay(e, day))
                  .map((event) => {
                    const color = colorOf(event);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(event)}
                          className="block w-full truncate rounded-[5px] px-1.5 py-0.5 text-left text-[12px] font-medium"
                          style={{ background: accentFill(color, 26), color: accentText(color) }}
                        >
                          {event.subject}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            ))}
          </div>
        )}
      </div>

      {/* Stundenraster */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className="relative grid" style={{ gridTemplateColumns: columns, height: 24 * HOUR }}>
          <div className="relative">
            {HOURS.slice(1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] text-snow/40 tabular-nums" style={{ top: h * HOUR }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
            {days.some((d) => sameDay(d, today)) && (
              <span
                className="absolute right-1 z-[3] -translate-y-1/2 rounded px-1 text-[11px] font-semibold text-white tabular-nums"
                style={{ top: nowTop, background: TODAY_RED }}
              >
                {time(now)}
              </span>
            )}
          </div>
          {days.map((day) => {
            const isToday = sameDay(day, today);
            const placed = layoutDay(timed.filter((e) => onDay(e, day)), day);
            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-snow/[0.08]"
                onDoubleClick={(event) => createAt(day, event)}
              >
                {HOURS.slice(1).map((h) => (
                  <span key={h} className="pointer-events-none absolute inset-x-0 border-t border-snow/[0.07]" style={{ top: h * HOUR }} />
                ))}
                {placed.map(({ event, top, height, column, columns: cols }) => {
                  const color = colorOf(event);
                  const short = height < 40;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onOpen(event)}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="absolute z-[1] flex flex-col items-stretch justify-start overflow-hidden rounded-[6px] border-l-[3px] px-1.5 py-0.5 text-left text-[12px] leading-tight hover:z-[2] hover:shadow-[0_4px_14px_var(--shadow-color)]"
                      style={{
                        top: (top * HOUR) / 60 + 1,
                        height: Math.max(18, (height * HOUR) / 60 - 2),
                        left: `calc(${(column / cols) * 100}% + 2px)`,
                        width: `calc(${100 / cols}% - 4px)`,
                        background: accentFill(color, 22),
                        borderColor: color,
                      }}
                    >
                      <span className="block truncate font-semibold" style={{ color: accentText(color) }}>
                        {event.subject}
                        {short && <span className="font-normal opacity-80"> · {time(event.start)}</span>}
                      </span>
                      {!short && (
                        <span className="block truncate text-[11px]" style={{ color: accentText(color) }}>
                          {time(event.start)}–{time(event.end)}
                          {event.location && ` · ${event.location}`}
                        </span>
                      )}
                    </button>
                  );
                })}
                {isToday && (
                  <span className="pointer-events-none absolute inset-x-0 z-[3] h-0.5 -translate-y-1/2" style={{ top: nowTop, background: TODAY_RED }}>
                    <span className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rounded-full" style={{ background: TODAY_RED }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
