"use client";

import { cn } from "@/lib/cn";
import { monthDays, sameDay, WEEKDAYS } from "./dates";

/** Rot für „heute“ wie in Apple Kalender, in beiden Modi gut lesbar */
export const TODAY_RED = "#ff453a";

export function MiniMonth({
  month,
  today,
  selected,
  onSelect,
  title,
  onTitleClick,
  compact,
  hideOutside,
}: {
  month: Date;
  today: Date;
  selected?: Date;
  onSelect: (day: Date) => void;
  title?: React.ReactNode;
  onTitleClick?: () => void;
  compact?: boolean;
  /** Tage aus Nachbarmonaten ausblenden (Jahresansicht) */
  hideOutside?: boolean;
}) {
  const days = monthDays(month);
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
  return (
    <div>
      {title !== undefined && (
        <button
          type="button"
          onClick={onTitleClick}
          className="mb-1.5 px-1 text-left text-[15px] font-semibold hover:opacity-80"
          style={isCurrentMonth ? { color: TODAY_RED } : undefined}
        >
          {title}
        </button>
      )}
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="pb-1 text-[10px] font-medium text-snow/40">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = inMonth && sameDay(day, today);
          if (hideOutside && !inMonth) return <span key={day.toISOString()} aria-hidden />;
          const isSelected = selected && sameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={day.toLocaleDateString("de-DE", { dateStyle: "full" })}
              className={cn(
                "mx-auto grid place-items-center rounded-full tabular-nums transition-colors",
                compact ? "h-6 w-6 text-[11px]" : "h-7 w-7 text-[12px]",
                !inMonth && "text-snow/25",
                inMonth && !isToday && "text-snow/80 hover:bg-snow/10",
                isSelected && !isToday && "bg-snow/15 font-semibold text-snow",
                isToday && "font-semibold text-white"
              )}
              style={isToday ? { background: TODAY_RED } : undefined}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
