"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useInView } from "framer-motion";
import { clients, heroStats } from "@/lib/content";
import { scrollToId } from "@/lib/scroll";
import { EventTeaser } from "./EventTeaser";

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Only shrink the viewport vertically — a horizontal margin would keep
  // stats near the screen edge from ever intersecting.
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString("de-DE")}
      {suffix}
    </span>
  );
}

export function HeroSection() {
  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center px-4 pb-28">
      {/* Light hero card: Snow/Dawn surface with Sky/Earth type — the
          bright opening act before the dark reference band below. */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-[2rem] bg-gradient-to-b from-snow via-snow to-dawn px-5 py-8 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.55)]"
      >
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-xs font-medium uppercase tracking-[0.25em] text-earth"
        >
          Social Media Agentur — Berlin &amp; Frankfurt
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 text-[2.35rem] font-medium leading-[1.05] tracking-tight text-sky"
        >
          Marken, die man
          <br />
          nicht <span className="italic text-earth">wegscrollen</span>
          <br />
          kann.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-5 max-w-[24rem] text-base font-light leading-relaxed text-sky/75"
        >
          Wir sind dein unfairer Vorteil im Feed. Strategie, Content, Editing —
          und ein Gespür für Trends, bevor sie welche sind. Dein Feed wird das
          Problem deiner Konkurrenz.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-7 flex gap-2"
        >
          <a
            href="#dm"
            onClick={(e) => {
              e.preventDefault();
              scrollToId("dm");
            }}
            className="flex-1 rounded-full bg-sky py-3 text-center text-sm font-medium text-snow transition-all active:scale-[0.97]"
          >
            Lass uns reden
          </a>
          <a
            href="#feed"
            onClick={(e) => {
              e.preventDefault();
              scrollToId("feed");
            }}
            className="flex-1 rounded-full border border-sky/15 bg-sky/5 py-3 text-center text-sm font-medium text-sky transition-all active:scale-[0.97]"
          >
            Live-Arbeit ansehen
          </a>
        </motion.div>

        <EventTeaser light />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-9 flex justify-between border-t border-sky/10 pt-5"
        >
          {heroStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-xl font-medium text-sky">
                <CountUp value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-0.5 text-[11px] font-light text-earth">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Dark reference band: the client logos pop against Sky again. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.85 }}
        className="relative mt-10 overflow-hidden"
        aria-label="Unsere Kunden"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-sky to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-sky to-transparent" />
        {/* No flex gap here: each item carries its own trailing margin so
            both halves are exactly the same width and the -50% loop point
            lands seamlessly on the start of the second copy. */}
        <div className="marquee flex w-max items-center">
          {[...clients, ...clients].map((client, i) => (
            <span
              key={`${client.name}-${i}`}
              className="mr-10 flex shrink-0 items-center"
            >
              {client.logo ? (
                // Every copy loads eagerly: a lazy second half would grow
                // the strip mid-animation and make the loop visibly jump.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo}
                  alt={client.name}
                  style={{ height: client.height ?? 32 }}
                  className="w-auto opacity-90"
                  loading="eager"
                />
              ) : (
                <span className="whitespace-nowrap text-sm font-light uppercase tracking-[0.15em] text-snow/40">
                  {client.name}
                </span>
              )}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1 }}
        className="mt-4 text-center"
      >
        <Link
          href="/referenzen"
          className="text-sm font-medium text-dune underline-offset-4 hover:underline"
        >
          Alle Referenzen ansehen →
        </Link>
      </motion.p>
    </div>
  );
}
