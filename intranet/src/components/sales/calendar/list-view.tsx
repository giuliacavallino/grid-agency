"use client";

import { MapPin, Repeat, Video } from "lucide-react";
import type { CalEvent } from "@/lib/graph";
import { Empty } from "@/components/ui";
import { addDays, isAllDayLike, onDay, sameDay, time } from "./dates";
import { TODAY_RED } from "./mini-month";

/** Liste: Termine der nächsten vier Wochen nach Tagen gruppiert */
export function ListView({
  start,
  days: count,
  today,
  events,
  colorOf,
  onOpen,
}: {
  start: Date;
  days: number;
  today: Date;
  events: CalEvent[];
  colorOf: (event: CalEvent) => string;
  onOpen: (event: CalEvent) => void;
}) {
  const days = Array.from({ length: count }, (_, i) => addDays(start, i))
    .map((day) => ({ day, items: events.filter((e) => onDay(e, day)).sort((a, b) => a.start.getTime() - b.start.getTime()) }))
    .filter(({ items }) => items.length);
  if (!days.length) return <Empty title="Keine Termine" text="In diesen vier Wochen steht nichts im Kalender." />;
  return (
    <div className="h-full overflow-y-auto px-2 py-3 md:px-4">
      {days.map(({ day, items }) => {
        const isToday = sameDay(day, today);
        return (
          <section key={day.toISOString()} className="mb-4">
            <h3 className="sticky top-0 z-[1] bg-surface/95 px-2 py-1.5 text-[12.5px] font-semibold tracking-wide uppercase backdrop-blur" style={isToday ? { color: TODAY_RED } : undefined}>
              {day.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
              {isToday && " · heute"}
            </h3>
            <ul className="flex flex-col gap-1">
              {items.map((event) => {
                const color = colorOf(event);
                return (
                  <li key={event.id}>
                    <button type="button" onClick={() => onOpen(event)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-snow/[0.05]">
                      <span className="w-24 shrink-0 text-[13px] text-snow/60 tabular-nums">{isAllDayLike(event) ? "ganztägig" : `${time(event.start)}–${time(event.end)}`}</span>
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                          {event.recurring && <Repeat className="h-3.5 w-3.5 shrink-0 text-snow/50" aria-label="Serientermin" />}
                          {event.subject}
                        </span>
                        {event.location && (
                          <span className="flex items-center gap-1 truncate text-[12.5px] text-snow/50">
                            <MapPin className="h-3 w-3 shrink-0" /> {event.location}
                          </span>
                        )}
                      </span>
                      {event.joinUrl && <Video className="h-4 w-4 shrink-0 text-snow/50" aria-label="Video-Call" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
