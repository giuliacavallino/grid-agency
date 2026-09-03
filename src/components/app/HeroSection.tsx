"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { animate, motion, useInView } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { calendlyUrl, clients, clientSlug, heroStats } from "@/lib/content";
import { scrollToId } from "@/lib/scroll";
import { EventTeaser } from "./EventTeaser";
import { HeroVideo } from "./HeroVideo";

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
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col justify-center px-5 pb-28 lg:pb-12">
      {/* Dark opening act with an aurora glow in client-brand colors:
          the backdrop breaks out of the content column and reaches up
          behind the top bar. */}
      <div className="relative">
        <HeroVideo />
        <div className="aurora absolute -top-24 bottom-0 left-1/2 w-screen -translate-x-1/2 opacity-80" />

        <div className="relative py-8 lg:py-16 lg:text-center">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-xs font-medium uppercase tracking-[0.25em] text-dune"
          >
            Deine #1 Social Media Agentur in Berlin &amp; Frankfurt
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 text-[2.6rem] font-medium leading-[1.05] tracking-tight text-snow drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)] lg:mx-auto lg:text-[clamp(4.5rem,8vw,6.75rem)] lg:leading-[1.02]"
          >
            Marken, die man
            <br />
            nicht{" "}
            <span className="text-scroll-gradient italic">wegscrollen</span>
            <br className="lg:hidden" />{" "}
            kann.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-6 max-w-[24rem] text-base font-light leading-relaxed text-snow/80 lg:mx-auto lg:max-w-[40rem] lg:text-xl"
          >
            Wir sind dein unfairer Vorteil im Feed. Strategie, Content, Editing,
            und ein Gespür für Trends, bevor sie welche sind. Dein Feed wird das
            Problem deiner Konkurrenz.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-7 flex gap-2 lg:mx-auto lg:max-w-md"
          >
            {/* Direkt zur Calendly-Buchung — unverbindliches Erstgespräch,
                öffnet im neuen Tab statt zur DM-Sektion zu scrollen. */}
            <a
              href={calendlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-rainbow flex flex-1 items-center justify-center gap-2 rounded-full bg-snow py-3 text-center text-sm font-medium text-sky active:scale-[0.97]"
            >
              <CalendarClock className="h-4 w-4 shrink-0" strokeWidth={2} />
              Jetzt Erstgespräch buchen!
            </a>
            <a
              href="#cases"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("cases");
              }}
              className="glass flex-1 rounded-full py-3 text-center text-sm font-medium text-snow transition-all active:scale-[0.97]"
            >
              Cases ansehen
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-9 flex justify-between border-t border-snow/10 pt-5 lg:mx-auto lg:max-w-lg"
          >
            {heroStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-xl font-medium text-snow lg:text-2xl">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-0.5 text-[11px] font-light text-snow/50">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Client logo band, full-bleed. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.85 }}
        className="relative left-1/2 mt-10 w-screen -translate-x-1/2 overflow-hidden"
        aria-label="Unsere Kunden"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-sky to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-sky to-transparent" />
        {/* No flex gap here: each item carries its own trailing margin so
            both halves are exactly the same width and the -50% loop point
            lands seamlessly on the start of the second copy. */}
        {/* Hovering pauses the drift so the logos are easy to hit —
            each one links straight to its client page. */}
        <div className="marquee flex w-max items-center [&:hover]:[animation-play-state:paused]">
          {[...clients, ...clients].map((client, i) => (
            <Link
              key={`${client.name}-${i}`}
              href={`/projekte/${clientSlug(client.name)}`}
              aria-label={`${client.name}, Projekt ansehen`}
              className="mr-10 flex shrink-0 items-center transition-transform duration-200 hover:scale-110"
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
            </Link>
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
          href="/projekte"
          className="text-sm font-medium text-dune underline-offset-4 hover:underline"
        >
          Alle Projekte ansehen →
        </Link>
      </motion.p>

      <div className="lg:mx-auto lg:w-full lg:max-w-2xl">
        <EventTeaser />
      </div>
    </div>
  );
}
