"use client";

/** Laufendes Typo-Band auf voller Breite: große Begriffe, abwechselnd im
 * Instagram-Verlauf (wie „wegscrollen“ im Hero) und in Snow. Rein dekorativ (aria-hidden), der
 * Loop nutzt die Marquee-Mechanik des Logo-Bands. */
export function TextMarquee({
  items,
  duration = 38,
}: {
  items: string[];
  duration?: number;
}) {
  return (
    <div
      aria-hidden
      className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden py-5 lg:py-7"
    >
      <div
        className="marquee flex w-max items-center whitespace-nowrap"
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {[...items, ...items].map((item, i) => {
          // Stil hängt nur an der Position innerhalb einer Hälfte, damit
          // beide Hälften identisch sind und der Loop nahtlos bleibt.
          const gradient = (i % items.length) % 2 === 0;
          return (
            <span
              key={`${item}-${i}`}
              className="flex items-center text-[2.75rem] font-medium leading-none tracking-tight lg:text-[5rem]"
            >
              <span
                className={
                  gradient
                    ? "text-scroll-gradient pb-[0.08em]"
                    : "pb-[0.08em] text-snow"
                }
              >
                {item}
              </span>
              <span className="mx-5 text-[0.5em] text-snow/35 lg:mx-8">✦</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
