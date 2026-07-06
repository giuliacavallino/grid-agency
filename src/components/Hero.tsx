"use client";

import { motion } from "framer-motion";
import { GridMonogram } from "./GridMonogram";

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden pt-24">
      <div className="grid-pattern-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky via-sky/95 to-sky" />

      <div className="pointer-events-none absolute -right-24 top-1/2 hidden -translate-y-1/2 opacity-60 md:block">
        <GridMonogram color="earth" size={420} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-dune"
        >
          Social Media Agentur · Berlin &amp; Frankfurt
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-tight text-snow sm:text-6xl md:text-7xl"
        >
          Dein Social Media
          <br />
          auf Autopilot.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-8 max-w-xl text-lg font-light text-snow/70"
        >
          We create content that keeps your brand in focus. Digitale
          Kommunikation im und außerhalb das Grid — mit Fokus auf soziale
          Medien, digitales Marketing und die neuesten Trends im
          Verbraucherverhalten.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a
            href="#kontakt"
            className="rounded-full bg-snow px-7 py-3.5 text-sm font-medium text-sky transition-transform hover:scale-105"
          >
            Kostenloses Erstgespräch
          </a>
          <a
            href="#arbeiten"
            className="rounded-full border border-snow/20 px-7 py-3.5 text-sm font-light text-snow/80 transition-colors hover:border-snow/50 hover:text-snow"
          >
            Unsere Arbeiten ansehen
          </a>
        </motion.div>
      </div>
    </section>
  );
}
