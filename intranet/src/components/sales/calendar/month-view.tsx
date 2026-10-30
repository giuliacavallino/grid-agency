"use client";

import { useEffect, useRef, useState } from "react";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CalEvent } from "@/lib/graph";
import { accentFill, accentText } from "@/lib/theme";
import { isAllDayLike, monthDays, onDay, sameDay, time, WEEKDAYS } from "./dates";
import { TODAY_RED } from "./mini-month";

const ROW = 20;

export function MonthView({
  anchor,
  today,
  events,
  colorOf,
  onOpen,
  onDay: openDay,
  onCreate,
}: {
  anchor: Date;
  today: Date;
  events: CalEvent[];
  colorOf: (event: CalEvent) => string;
  onOpen: (event: CalEvent) => void;
  onDay: (day: Date) => void;
  onCreate: (day: Date) => void;
}) {
  const days = monthDays(anchor);
  const weeks = days.length / 7;
  const gridRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(3);

  // So viele Termine je Zelle, wie in die Höhe passen; Rest als „+N weitere“
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(([entry]) => {
      const cell = entry.contentRect.height / weeks;
      setRows(Math.max(1, Math.floor((cell - 30) / ROW)));
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [weeks]);

  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="grid shrink-0 grid-cols-7 border-b border-snow/[0.08]">
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-2 py-1.5 text-right text-[12px] font-medium text-snow/50">
            {d}
          </span>
        ))}
      </div>
      <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {days.map((day) => {
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = sameDay(day, today);
          const dayEvents = events
            .filter((e) => onDay(e, day))
            .sort((a, b) => Number(isAllDayLike(b)) - Number(isAllDayLike(a)) || a.start.getTime() - b.start.getTime());
          const overflow = dayEvents.length > rows;
          const shown = overflow ? dayEvents.slice(0, Math.max(0, rows - 1)) : dayEvents;
          return (
            <div
              key={day.toISOString()}
              onDoubleClick={() => onCreate(day)}
              className={cn(
                "flex min-w-0 flex-col overflow-hidden border-r border-b border-snow/[0.08] px-1 pt-1 pb-0.5 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-snow/[0.02]"
              )}
            >
              <button
                type="button"
                onClick={() => openDay(day)}
                className={cn(
                  "ml-auto grid h-6 min-w-6 place-items-center rounded-full px-1 text-[13px] tabular-nums hover:bg-snow/10",
                  !inMonth && "text-snow/35",
                  isToday && "font-semibold text-white hover:bg-[#ff453a]"
                )}
                style={isToday ? { background: TODAY_RED } : undefined}
                aria-label={day.toLocaleDateString("de-DE", { dateStyle: "full" })}
              >
                {day.getDate() === 1 && !isToday ? day.toLocaleDateString("de-DE", { day: "numeric", month: "short" }) : day.getDate()}
              </button>
              <ul className="mt-0.5 flex min-h-0 flex-col gap-px">
                {shown.map((event) => {
                  const color = colorOf(event);
                  const allDay = isAllDayLike(event);
                  return (
                    <li key={event.id}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(event);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="flex h-[19px] w-full items-center gap-1.5 rounded-[5px] px-1.5 text-left text-[12px] leading-none hover:brightness-110"
                        style={allDay ? { background: accentFill(color, 26), color: accentText(color) } : undefined}
                      >
                        {!allDay && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
                        <span className="min-w-0 flex-1 truncate">{event.subject}</span>
                        {event.recurring && <Repeat className="h-3 w-3 shrink-0 text-snow/45" aria-label="Serientermin" />}
                        {!allDay && <span className="hidden shrink-0 text-[11px] text-snow/45 lg:inline">{time(event.start)}</span>}
                      </button>
                    </li>
                  );
                })}
                {overflow && (
                  <li>
                    <button
                      type="button"
                      onClick={() => openDay(day)}
                      className="px-1.5 text-[11.5px] font-medium text-snow/55 hover:text-snow"
                    >
                      +{dayEvents.length - shown.length} weitere
                    </button>
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
