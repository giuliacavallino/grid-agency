import { cn as clsx } from "@/lib/cn";

// Abschluss: grüner Haken zeichnet sich, Ring pulsiert, Funken fliegen raus.

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const distance = 70 + (i % 3) * 18;
  return {
    x: `${Math.round(Math.cos(angle) * distance)}px`,
    y: `${Math.round(Math.sin(angle) * distance)}px`,
    color: ["bg-success", "bg-[#fa7e1e]", "bg-[#d62976]", "bg-[#962fbf]", "bg-[#feda75]"][i % 5],
    size: i % 2 ? "h-1.5 w-1.5" : "h-2.5 w-2.5",
  };
});

export function CallDone({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="py-16 text-center" role="status">
      <div className="relative mx-auto h-28 w-28">
        <span className="glow-pulse absolute inset-0 rounded-full bg-success/40" />
        <span className="meet-done-ring absolute inset-0 rounded-full border-2 border-success/50" />
        {SPARKS.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className={clsx("meet-spark absolute top-1/2 left-1/2 -mt-1 -ml-1 rounded-full", s.color, s.size)}
            style={{ "--x": s.x, "--y": s.y, "--delay": `${700 + (i % 4) * 40}ms` } as React.CSSProperties}
          />
        ))}
        <svg viewBox="0 0 80 80" className="meet-done-pop relative h-28 w-28 text-success" aria-hidden>
          <circle cx="40" cy="40" r="36" className="fill-success/12" />
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="draw" style={{ "--length": 227 } as React.CSSProperties} transform="rotate(-90 40 40)" />
          <path
            d="M25 41 l10 10 l20 -22"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="draw"
            style={{ "--length": 46, "--delay": "450ms" } as React.CSSProperties}
          />
        </svg>
      </div>
      <p className="rise-in mt-8 text-xs font-medium tracking-[0.25em] text-success uppercase" style={{ "--delay": "650ms" } as React.CSSProperties}>
        Erledigt
      </p>
      <h1 className="rise-in mt-2 text-4xl font-semibold tracking-tight md:text-5xl" style={{ "--delay": "750ms" } as React.CSSProperties}>
        {title}
      </h1>
      <p className="rise-in mx-auto mt-3 max-w-sm text-[15px] text-snow/65" style={{ "--delay": "850ms" } as React.CSSProperties}>
        {text}
      </p>
      {children && (
        <div className="rise-in mt-7" style={{ "--delay": "1000ms" } as React.CSSProperties}>
          {children}
        </div>
      )}
    </div>
  );
}
