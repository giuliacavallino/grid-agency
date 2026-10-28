"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { roadmap } from "@/lib/content";
import { SectionWatermark } from "./SectionWatermark";
import { SnapRow } from "./SnapRow";
import { CalendlyLink } from "./CalendlyProvider";

/** Roadmap einer Zusammenarbeit, nach der Agentur-Präsentation:
 * fünf Stationen von der Terminanfrage bis zur laufenden Betreuung.
 * Desktop als horizontale Timeline, mobil als Wisch-Reihe, damit die
 * Sektion auf einen Bildschirm passt. */
export function RoadmapSection() {
  return (
    <div className="screen px-5 lg:px-gutter">
      <SectionWatermark word="Roadmap" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Unsere Roadmap
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow lg:text-4xl">
          Haben wir dein
          <br />
          <span className="text-scroll-gradient">Interesse</span> geweckt?
        </h2>
      </motion.div>

      {/* Desktop: fünf Spalten an einer horizontalen Linie. */}
      <div className="mt-[clamp(2.5rem,8svh,5rem)] hidden lg:block">
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
                <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-snow/25 bg-sky text-[0.6875rem] font-medium text-snow">
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

      {/* Mobil: Stationen zum Wischen, die Linie läuft durch die Karten. */}
      <div className="mt-8 lg:hidden">
        <SnapRow label="Roadmap" className="items-stretch">
          {roadmap.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="glass w-[72%] max-w-[18rem] rounded-2xl p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-snow/25 bg-sky text-[0.6875rem] font-medium text-snow">
                  {step.number}
                </span>
                {i < roadmap.length - 1 && (
                  <span className="h-px flex-1 bg-snow/15" />
                )}
              </div>
              <h3 className="mt-4 text-base font-medium tracking-tight text-snow">
                {step.title}
              </h3>
              <p className="mt-1.5 text-sm font-light leading-relaxed text-snow/65">
                {step.text}
              </p>
            </motion.div>
          ))}
        </SnapRow>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mt-[clamp(2rem,7svh,4.5rem)] flex flex-col items-center gap-4"
      >
        <CalendlyLink
          className="btn-rainbow flex items-center justify-center gap-2 rounded-full bg-snow px-7 py-3 text-sm font-medium text-sky active:scale-[0.97]"
        >
          Jetzt Erstgespräch buchen
        </CalendlyLink>
        <p className="text-sm font-light text-snow/50">
          Noch Fragen?{" "}
          <Link
            href="/faq"
            className="font-medium text-dune underline-offset-4 hover:underline"
          >
            Antworten in unseren FAQ →
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
