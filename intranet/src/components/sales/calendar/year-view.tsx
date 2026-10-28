"use client";

import { MiniMonth } from "./mini-month";

export function YearView({
  year,
  today,
  onMonth,
  onDay,
}: {
  year: number;
  today: Date;
  onMonth: (month: Date) => void;
  onDay: (day: Date) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-8 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const month = new Date(year, m, 1);
        return (
          <MiniMonth
            key={m}
            month={month}
            today={today}
            onSelect={onDay}
            title={month.toLocaleDateString("de-DE", { month: "long" })}
            onTitleClick={() => onMonth(month)}
          />
        );
      })}
    </div>
  );
}
