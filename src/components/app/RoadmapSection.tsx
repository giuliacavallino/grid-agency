"use client";

import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { calendlyUrl, roadmap } from "@/lib/content";

/** Roadmap einer Zusammenarbeit, nach der Agentur-Präsentation:
 * fünf Stationen von der Terminanfrage bis zur laufenden Betreuung.
 * Desktop als horizontale Timeline, mobil untereinander. */
export function RoadmapSection() {
  return (
    <div className="px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Unsere Roadmap
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Haben wir dein
          <br />
          <span className="text-scroll-gradient">Interesse</span> geweckt?
        </h2>
      </motion.div>

      {/* Desktop: fünf Spalten an einer horizontalen Linie. */}
      <div className="mt-10 hidden lg:block">
        <div className="relative">
          <span className="absolute left-4 right-4 top-4 h-px bg-snow/15" />
          <div className="grid grid-cols-5 gap-6">
            {roadmap.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-70px" }}
                transition={{ duration: 0.5, delay: i * 0.09 }}
                className="relative"
              >
                <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-snow/25 bg-sky text-[11px] font-medium text-snow">
                  {step.number}
                </span>
                <h3 className="mt-4 text-base font-medium tracking-tight text-snow">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobil: vertikale Timeline. */}
      <div className="mt-8 lg:hidden">
        {roadmap.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className="relative flex gap-4 pb-6 last:pb-0"
          >
            <div className="flex flex-col items-center">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-snow/25 bg-sky text-[11px] font-medium text-snow">
                {step.number}
              </span>
              {i < roadmap.length - 1 && (
                <span className="mt-1 w-px flex-1 bg-snow/15" />
              )}
            </div>
            <div className="pb-1">
              <h3 className="text-base font-medium tracking-tight text-snow">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm font-light leading-relaxed text-snow/65">
                {step.text}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mt-10 flex justify-center"
      >
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-rainbow flex items-center justify-center gap-2 rounded-full bg-snow px-7 py-3 text-sm font-medium text-sky active:scale-[0.97]"
        >
          <CalendarClock className="h-4 w-4" strokeWidth={2} />
          Jetzt Erstgespräch buchen!
        </a>
      </motion.div>
    </div>
  );
}
