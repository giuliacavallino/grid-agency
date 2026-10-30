"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { agencyResults, caseStudyTeasers, clientSlug } from "@/lib/content";
import { SectionWatermark } from "./SectionWatermark";
import { BookingLink } from "./BookingProvider";
import { SnapRow } from "./SnapRow";

/** Case Studies aus der Agentur-Präsentation auf der Startseite:
 * oben die Durchschnittszahlen über alle Kunden, darunter drei Karten
 * mit den freigestellten Phone-Mockups aus dem Deck, verlinkt auf die
 * vollständigen Cases der Kundenseiten.
 * Ergebnisse und Cases sind je ein eigener Bildschirm, mobil mit
 * Wisch-Reihen, ab Desktop als Dreier-Raster. */
export function CaseStudiesSection() {
  return (
    <div className="relative px-5 lg:px-gutter">
      <SectionWatermark word="Cases" />

      {/* Ergebnisse: Desktop Überschrift links, CTA rechts daneben,
          darunter die drei Zahlen. */}
      <div className="screen lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:content-center lg:items-end lg:gap-x-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Case Studies
          </p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow lg:text-4xl">
            Ergebnisse
            <br />
            statt <span className="text-scroll-gradient">Versprechen</span>.
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-snow/65 lg:mt-4">
            Wir lieben es, dein Grid zum Strahlen zu bringen. Mit GRID schreibst
            du nicht nur Erfolgsgeschichten, sondern setzt den Maßstab für
            Social Media neu.
          </p>
        </motion.div>

        {/* Durchschnittswerte über alle Kunden, aus dem Referenzdokument. */}
        <div className="mt-6 lg:order-last lg:col-span-2 lg:mt-[clamp(2rem,6svh,4rem)]">
          <SnapRow
            label="Ergebnisse"
            className="items-stretch lg:m-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:p-0"
          >
            {agencyResults.map((r, i) => (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="glass w-[86%] max-w-[20rem] rounded-2xl p-4 lg:w-auto lg:max-w-none lg:p-7"
              >
                <p className="text-scroll-gradient whitespace-nowrap text-4xl font-medium tracking-tight lg:text-5xl xl:text-6xl">
                  {r.value}
                </p>
                <p className="mt-1 text-sm font-medium text-snow lg:mt-2 lg:text-base">{r.label}</p>
                <p className="mt-2 text-[13px] font-light leading-snug text-snow/60 lg:text-sm lg:leading-relaxed">
                  {r.text}
                </p>
              </motion.div>
            ))}
          </SnapRow>
          <p className="mt-2 text-[0.6875rem] font-light text-snow/40">
            Durchschnittswerte unserer Kund:innen, Quelle: Meta Business Suite
          </p>
        </div>

        {/* Zwischen-CTA: direkt nach den Ergebnissen ist der beste Moment
            für die Terminbuchung, ohne bis ganz unten scrollen zu müssen. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-5 flex flex-col items-center gap-2 text-center lg:mt-0 lg:items-end lg:gap-3 lg:text-right"
        >
          <p className="text-sm font-light text-snow/65">
            Ergebnisse wie diese für deine Marke?
          </p>
          <BookingLink
            className="btn-rainbow flex items-center justify-center gap-2 rounded-full bg-snow px-7 py-3 text-sm font-medium text-sky active:scale-[0.97]"
          >
            Unverbindliches Erstgespräch buchen
          </BookingLink>
        </motion.div>
      </div>

      {/* Die drei Cases: mobil zum Wischen, Desktop nebeneinander. */}
      <div className="screen">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Unsere Cases
        </p>
        <SnapRow
          label="Case Studies"
          className="mt-4 items-stretch lg:m-0 lg:mt-6 lg:grid lg:grid-cols-3 lg:overflow-visible lg:p-0"
        >
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
              className="w-[86%] max-w-[22rem] lg:w-auto lg:max-w-none"
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
                    className="mx-auto h-[clamp(8rem,24svh,18rem)] w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03] lg:h-[clamp(10rem,30svh,28rem)]"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-dune">
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
        </SnapRow>
      </div>
    </div>
  );
}
