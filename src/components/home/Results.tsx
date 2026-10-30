import { agencyResults } from "@/lib/content";

/** Kennzahlen-Band: Durchschnittswerte über alle Kund:innen. */
export function Results() {
  return (
    <section className="relative py-10 lg:py-16">
      <div className="mx-auto w-full max-w-frame px-5 lg:max-w-frame-wide lg:px-gutter">
        <div className="glass grid overflow-hidden rounded-[2rem] lg:grid-cols-3">
          {agencyResults.map((r, i) => (
            <div
              key={r.label}
              className={`reveal p-7 lg:p-10 ${i > 0 ? "border-t border-snow/10 lg:border-l lg:border-t-0" : ""}`}
              style={{ "--d": `${i * 100}ms` } as React.CSSProperties}
            >
              <p className="text-aurora text-5xl font-semibold tracking-[-0.04em] tabular-nums lg:text-[clamp(3.5rem,5vw,5rem)]">{r.value}</p>
              <p className="mt-2 text-base font-medium text-snow">{r.label}</p>
              <p className="mt-2 text-sm font-light leading-relaxed text-snow/55">{r.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[0.6875rem] font-light text-snow/35">Durchschnitt über unsere Kund:innen</p>
      </div>
    </section>
  );
}
