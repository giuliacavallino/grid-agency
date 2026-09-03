"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarClock } from "lucide-react";
import { calendlyUrl, caseStudyTeasers, clientSlug } from "@/lib/content";
import { SectionWatermark } from "./SectionWatermark";

/** Case Studies aus der Agentur-Präsentation auf der Startseite:
 * drei Karten mit den freigestellten Phone-Mockups aus dem Deck,
 * verlinkt auf die vollständigen Cases der Kundenseiten. */
export function CaseStudiesSection() {
  return (
    <div className="relative px-5 py-12">
      <SectionWatermark word="Cases" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Case Studies
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Ergebnisse
          <br />
          statt <span className="text-scroll-gradient">Versprechen</span>.
        </h2>
      </motion.div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {caseStudyTeasers.map((cs, i) => (
          <motion.div
            key={cs.client}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{
              duration: 0.55,
              delay: i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <Link
              href={`/projekte/${clientSlug(cs.client)}`}
              className="card-rainbow group flex h-full flex-col overflow-hidden rounded-2xl border border-snow/10"
            >
              <div className="px-6 pt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cs.image}
                  alt={`${cs.client}, Case Study Mockup`}
                  loading="lazy"
                  className="mx-auto h-64 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03] sm:h-72"
                />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dune">
                  Case Study #{i + 1}
                </p>
                <h3 className="card-rainbow-title mt-2 text-xl font-medium tracking-tight text-snow">
                  {cs.client}
                </h3>
                <p className="mt-1 text-sm font-medium text-snow/85">
                  {cs.stat}
                </p>
                <p className="mt-2 flex-1 text-sm font-light leading-relaxed text-snow/65">
                  {cs.teaser}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-snow/80 transition-colors group-hover:text-snow">
                  Zum ganzen Case
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Zwischen-CTA: direkt nach den Ergebnissen ist der beste Moment
          für die Terminbuchung, ohne bis ganz unten scrollen zu müssen. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mt-8 flex flex-col items-center gap-3 text-center"
      >
        <p className="text-sm font-light text-snow/65">
          Ergebnisse wie diese für deine Marke?
        </p>
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-rainbow flex items-center justify-center gap-2 rounded-full bg-snow px-7 py-3 text-sm font-medium text-sky active:scale-[0.97]"
        >
          <CalendarClock className="h-4 w-4" strokeWidth={2} />
          Unverbindliches Erstgespräch buchen
        </a>
      </motion.div>
    </div>
  );
}
