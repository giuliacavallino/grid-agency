"use client";

import { useEffect, useState } from "react";
import { Eye, Heart, Play, Share2, TrendingUp, UserPlus } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { EbookCard, LogoMarquee } from "./brand";

// Warteseite im Call, solange noch niemand sonst da ist: Motion Graphics zu
// Social-Media-Performance und Skalierung. Die Zahlen sind echte Ergebnisse
// aus den Case Studies der Website (src/lib/content.ts im Website-Projekt).

type Stat = {
  from?: number;
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  source: string;
  /** Form der Kurve: 0 = gleichmäßig, 1 = steil am Ende (Skalierung) */
  curve: number;
};

const STATS: Stat[] = [
  { from: 6000, to: 49000, suffix: "+", label: "Follower", source: "Goldies · von 6.000 auf 49.000+", curve: 0.75 },
  { to: 3.9, decimals: 1, suffix: " Mio.", label: "Aufrufe", source: "Frittenwerk", curve: 0.95 },
  { to: 2199, prefix: "+", suffix: " %", label: "mehr Instagram-Reichweite", source: "lovebirds · nach 3 Monaten", curve: 1 },
  { to: 125000, suffix: "+", label: "Follower auf Instagram", source: "Frittenwerk", curve: 0.6 },
  { to: 875, prefix: "+", suffix: " %", label: "mehr Reichweite", source: "im Schnitt über unsere Kund:innen", curve: 0.85 },
  { to: 450000, label: "neue Profilaufrufe", source: "im Schnitt über unsere Kund:innen", curve: 0.7 },
];

const CYCLE_MS = 5200;

const format = (value: number, decimals = 0) =>
  value.toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Zählt von `from` auf `to` hoch, mit Ease-out */
function CountUp({ stat }: { stat: Stat }) {
  const start = stat.from ?? 0;
  const [value, setValue] = useState(start);
  useEffect(() => {
    if (reducedMotion()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ohne Animation gleich der Endwert
      setValue(stat.to);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / 2200);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(start + (stat.to - start) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stat, start]);
  return (
    <span className="tabular-nums">
      {stat.prefix}
      {format(value, stat.decimals)}
      {stat.suffix}
    </span>
  );
}

/** Wachstumskurve als SVG-Pfad: flach am Anfang, steil am Ende */
function curvePath(steep: number) {
  const points = Array.from({ length: 25 }, (_, i) => {
    const x = i / 24;
    const y = (1 - steep) * x + steep * Math.pow(x, 3.2);
    // leichtes Rauschen, damit es nach echten Daten aussieht
    const wobble = Math.sin(i * 1.7) * 0.025 * (1 - x);
    return [8 + x * 304, 172 - Math.max(0, y + wobble) * 150] as const;
  });
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function GrowthChart({ stat, round }: { stat: Stat; round: number }) {
  const path = curvePath(stat.curve);
  return (
    <div className="relative">
      <svg viewBox="0 0 320 180" className="h-auto w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id="meet-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#feda75" />
            <stop offset="0.35" stopColor="#fa7e1e" />
            <stop offset="0.7" stopColor="#d62976" />
            <stop offset="1" stopColor="#962fbf" />
          </linearGradient>
          <linearGradient id="meet-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#d62976" stopOpacity="0.35" />
            <stop offset="1" stopColor="#d62976" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[22, 72, 122, 172].map((y) => (
          <line key={y} x1="8" x2="312" y1={y} y2={y} className="stroke-snow/10" strokeDasharray="3 5" />
        ))}
        <g key={round}>
          <path d={`${path} L312,172 L8,172 Z`} fill="url(#meet-fill)" className="meet-area" />
          <path d={path} pathLength={1} fill="none" stroke="url(#meet-stroke)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="meet-curve" />
          <g className="meet-dot" style={{ "--path": `path("${path}")` } as React.CSSProperties}>
            <circle r="12" className="meet-ping fill-[#d62976]/40" />
            <circle r="6" className="fill-snow stroke-[#d62976]" strokeWidth="3" />
          </g>
        </g>
      </svg>
      {/* Mini-Säulen für „Engagement“ */}
      <div className="absolute top-2 left-3 flex h-8 items-end gap-1" aria-hidden>
        {[0, 0.2, 0.4, 0.15, 0.35].map((delay, i) => (
          <span key={i} className="meet-bar w-1.5 rounded-full bg-snow/35" style={{ height: "100%", "--delay": `${delay}s` } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

const TOASTS = [
  { icon: UserPlus, text: "Neue Follower", sub: "gerade eben", className: "-left-6 top-6 md:-left-14", delay: 0.4 },
  { icon: Play, text: "Reel geht viral", sub: "Aufrufe steigen", className: "-right-4 top-1/3 md:-right-12", delay: 3.4 },
  { icon: Share2, text: "Story geteilt", sub: "von deiner Community", className: "-left-4 bottom-10 md:-left-10", delay: 6.4 },
];

const FLOATERS = [
  { left: "80%", drift: "-34px", duration: "4.4s", delay: "0s", size: "h-6 w-6" },
  { left: "88%", drift: "16px", duration: "3.8s", delay: "0.7s", size: "h-4 w-4" },
  { left: "72%", drift: "-14px", duration: "5s", delay: "1.4s", size: "h-5 w-5" },
  { left: "92%", drift: "-24px", duration: "4.2s", delay: "2.1s", size: "h-7 w-7" },
  { left: "84%", drift: "28px", duration: "4.8s", delay: "2.8s", size: "h-4 w-4" },
  { left: "76%", drift: "8px", duration: "4s", delay: "3.4s", size: "h-6 w-6" },
  { left: "90%", drift: "-8px", duration: "4.6s", delay: "4.1s", size: "h-5 w-5" },
];

/** Bühne der Warteseite. `selfView` ist das eigene Kamerabild (oder ein Platzhalter). */
export function WaitingStage({ isHost, selfView }: { isHost: boolean; selfView: React.ReactNode }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setRound((r) => r + 1), CYCLE_MS);
    return () => window.clearInterval(id);
  }, []);
  const stat = STATS[round % STATS.length];

  return (
    <div className="relative isolate h-full min-h-0 overflow-hidden rounded-3xl border border-snow/10 bg-canvas">
      {/* Hintergrund: Aurora-Flecken und Raster, das auf einen zufliegt */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="meet-blob absolute -top-1/4 -left-1/6 h-[70%] w-[55%] rounded-full bg-[#fa7e1e]/20 blur-3xl" />
        <div className="meet-blob absolute -right-1/6 -bottom-1/4 h-[75%] w-[55%] rounded-full bg-[#962fbf]/20 blur-3xl" style={{ "--delay": "-5s" } as React.CSSProperties} />
        <div className="meet-blob absolute top-1/4 left-1/3 h-1/2 w-1/3 rounded-full bg-[#d62976]/15 blur-3xl" style={{ "--delay": "-9s" } as React.CSSProperties} />
        <div className="meet-grid absolute inset-x-[-25%] bottom-0 h-[55%]" />
      </div>

      <div className="flex h-full flex-col overflow-y-auto">
        <div className="grid flex-1 grid-cols-1 items-center gap-8 p-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-12 md:p-10 lg:px-14">
          {/* Links: Status, Kennzahl, eigenes Bild */}
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-snow/15 bg-sky/40 px-3 py-1 text-[11px] font-medium tracking-[0.22em] text-snow/70 uppercase backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="meet-ping absolute inset-0 rounded-full bg-success" />
                <span className="relative h-2 w-2 rounded-full bg-success" />
              </span>
              Du bist drin
            </p>
            <h2 className="mt-4 text-[2.5rem] leading-[1.02] font-semibold tracking-tight md:text-6xl">
              Gleich geht&apos;s <span className="text-aurora">los.</span>
            </h2>
            <p className="mt-3 max-w-md text-[15px] text-snow/65">
              {isHost ? "Sobald dein Gast da ist, startet der Call." : "Du wirst gleich in den Call geholt."} Bis dahin: So sieht Wachstum bei uns
              aus.
            </p>

            <div className="mt-7 md:mt-10">
              <div key={round} className="meet-stat">
                <p className="text-[2.75rem] leading-none font-semibold tracking-tight md:text-7xl">
                  <CountUp stat={stat} />
                </p>
                <p className="mt-2 text-lg font-medium md:text-xl">{stat.label}</p>
                <p className="mt-1 text-sm text-snow/55">{stat.source}</p>
              </div>
              <div className="mt-5 flex gap-1.5" aria-hidden>
                {STATS.map((_, i) => (
                  <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-snow/12">
                    {i === round % STATS.length && (
                      <span key={round} className="meet-progress block h-full rounded-full bg-snow" style={{ "--duration": `${CYCLE_MS}ms` } as React.CSSProperties} />
                    )}
                    {i < round % STATS.length && <span className="block h-full rounded-full bg-snow/50" />}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-7 flex items-center gap-3">
              <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-surface ring-1 ring-snow/15 md:w-44">{selfView}</div>
              <p className="text-xs text-snow/55">So sehen dich die anderen. Mikro und Kamera kannst du unten an- und ausschalten.</p>
            </div>
          </div>

          {/* Rechts: Dashboard-Karte mit Wachstumskurve, Benachrichtigungen und Reaktionen */}
          <div className="relative mx-auto w-full max-w-md md:mx-0">
            <div className="meet-hover relative rounded-3xl border border-snow/12 bg-sky/60 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.2em] text-snow/50 uppercase">Performance</p>
                  <p className="mt-1 text-sm font-medium">Letzte 90 Tage</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span key={round} className="meet-stat">
                    {stat.prefix === "+" ? `${stat.prefix}${format(stat.to, stat.decimals)}${stat.suffix}` : "Wachstum"}
                  </span>
                </span>
              </div>
              <div className="mt-4">
                <GrowthChart stat={stat} round={round} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: Eye, label: "Reichweite" },
                  { icon: Heart, label: "Engagement" },
                  { icon: UserPlus, label: "Community" },
                ].map(({ icon: Icon, label }, i) => (
                  <div key={label} className="rounded-xl bg-snow/[0.05] px-2 py-2.5">
                    <Icon className="mx-auto h-4 w-4 text-snow/70" />
                    <p className="mt-1 text-[11px] text-snow/60">{label}</p>
                    <div className="mx-auto mt-1.5 h-1 w-10 overflow-hidden rounded-full bg-snow/10">
                      <span
                        key={round}
                        className="meet-progress block h-full rounded-full bg-[linear-gradient(90deg,#fa7e1e,#d62976)]"
                        style={{ "--duration": `${1.6 + i * 0.4}s` } as React.CSSProperties}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {TOASTS.map(({ icon: Icon, text, sub, className, delay }) => (
              <div
                key={text}
                aria-hidden
                className={clsx("meet-toast absolute z-10 flex items-center gap-2.5 rounded-2xl border border-snow/12 bg-panel/90 py-2 pr-4 pl-2 shadow-xl backdrop-blur", className)}
                style={{ "--delay": `${delay}s` } as React.CSSProperties}
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[linear-gradient(135deg,#fa7e1e,#d62976,#962fbf)] text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-medium">{text}</span>
                  <span className="block text-[11px] text-snow/55">{sub}</span>
                </span>
              </div>
            ))}

            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-full">
              {FLOATERS.map(({ left, drift, duration, delay, size }, i) => (
                <Heart
                  key={i}
                  className={clsx("meet-float absolute bottom-6 fill-[#d62976] text-[#d62976] drop-shadow-lg", size, i % 3 === 1 && "fill-[#fa7e1e] text-[#fa7e1e]")}
                  style={{ left, "--drift": drift, "--duration": duration, "--delay": delay } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-end gap-4 border-t border-snow/[0.08] px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] md:px-10 lg:px-14">
          <LogoMarquee />
          <EbookCard className="bg-sky/50" />
        </div>
      </div>
    </div>
  );
}
