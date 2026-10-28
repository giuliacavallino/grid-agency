"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { extraServices, services } from "@/lib/content";
import { SectionWatermark } from "./SectionWatermark";
import { SnapRow } from "./SnapRow";

const cardMotion = (i: number) => ({
  initial: { opacity: 0, y: 28, scale: 0.97 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  viewport: { once: true, margin: "-70px" },
  transition: {
    duration: 0.55,
    delay: (i % 3) * 0.06,
    ease: [0.16, 1, 0.3, 1] as const,
  },
});

/** "Leistungen" auf der Homepage: die sechs Leistungsbereiche als
 * kompaktes Karten-Grid nebeneinander, jede Karte mit einem Hero-Foto
 * aus echten Produktionen. Details bleiben per Tap aufklappbar.
 * Bewusst als heller Block (Weiß auf voller Breite), damit die Seite
 * zwischen Dunkel und Hell atmet.
 * Jeder Teil passt auf einen Bildschirm: mobil als Wisch-Reihe, auf
 * Querformat-Screens Überschrift links und das 3×2-Grid rechts. */
export function ServicesSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="section-light relative left-1/2 w-screen -translate-x-1/2 bg-white text-sky">
      <SectionWatermark word="Leistungen" tone="light" />
      <div className="screen mx-auto w-full max-w-frame px-5 lg:max-w-frame-wide lg:px-gutter">
        <div className="lg:landscape:grid lg:landscape:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:landscape:items-center lg:landscape:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-earth">
              Leistungen
            </p>
            <h2 className="mt-2 text-3xl font-medium tracking-tight text-sky lg:text-4xl">
              Unsere Services.
              <br />
              <span className="text-scroll-gradient-strong">Deine Lösung</span>.
            </h2>
            <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-sky/70">
              Social Media für Gastronomie und Food. Unser Schwerpunkt sind
              Marken mit mehreren Standorten, die trotz ihrer Größe
              familiengeführt sind. Unsere Kanalarbeit endet nicht beim Posting,
              sie ist an konkrete Geschäftsziele gekoppelt, von lokaler
              Sichtbarkeit bis zu echtem Wachstum.
            </p>
          </motion.div>

          {/* Die sechs Bereiche nebeneinander: Foto, Titel, Tagline. Die
              Details klappen per Tap auf, so bleibt der Block kompakt. */}
          <SnapRow
            label="Leistungen"
            className="mt-5 items-stretch lg:m-0 lg:mt-8 lg:grid lg:auto-rows-fr lg:grid-cols-3 lg:overflow-visible lg:p-0 lg:landscape:mt-0"
          >
            {services.map((service, i) => (
              <motion.div
                key={service.number}
                {...cardMotion(i)}
                className="flex w-[78%] max-w-[20rem] lg:w-auto lg:max-w-none"
              >
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  className="card-rainbow group flex w-full flex-col overflow-hidden rounded-2xl border border-sky/15 bg-white text-left"
                >
                  {service.image && (
                    <div className="overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={service.image}
                        alt={`${service.title}${service.accent ? ` ${service.accent}` : ""}, Einblick aus einer Produktion`}
                        loading="lazy"
                        className="h-[clamp(7rem,18svh,11rem)] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] lg:h-[clamp(6rem,15svh,20rem)]"
                      />
                    </div>
                  )}
                  <div className="w-full flex-1 p-4 xl:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-earth">
                          {service.number}
                        </p>
                        <h3 className="card-rainbow-title mt-1 text-xl font-medium leading-snug tracking-tight text-sky lg:text-lg xl:text-xl">
                          {service.title}
                          {service.accent && (
                            <>
                              {" "}
                              <span className="card-rainbow-title text-scroll-gradient-strong">
                                {service.accent}
                              </span>
                            </>
                          )}
                        </h3>
                        <p className="mt-1 text-sm font-light text-sky/70">
                          {service.tagline}
                        </p>
                      </div>
                      <ChevronDown
                        className={`mt-1.5 h-5 w-5 shrink-0 text-sky/50 transition-transform duration-300 ${
                          open === i ? "rotate-180" : ""
                        }`}
                        strokeWidth={2}
                      />
                    </div>
                    <AnimatePresence initial={false}>
                      {open === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{
                            duration: 0.35,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="overflow-hidden"
                        >
                          <ul className="mt-3 space-y-2">
                            {service.bullets.map((bullet) => (
                              <li
                                key={bullet}
                                className="flex gap-2.5 text-sm font-light leading-relaxed text-sky/70"
                              >
                                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-earth" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                          {service.highlight && (
                            <p className="mt-4 rounded-xl bg-sky/[0.06] px-4 py-3 text-sm font-medium leading-relaxed text-sky">
                              {service.highlight}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </button>
              </motion.div>
            ))}
          </SnapRow>
        </div>
      </div>

      {/* Zusatzleistungen als eigener, kürzerer Block darunter. */}
      <div className="relative mx-auto w-full max-w-frame px-5 pb-16 pt-4 lg:max-w-frame-wide lg:px-gutter lg:pb-20">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="text-xs font-medium uppercase tracking-[0.2em] text-earth"
        >
          Zusatzleistungen
        </motion.p>
        <SnapRow
          label="Zusatzleistungen"
          className="mt-4 items-stretch sm:m-0 sm:mt-4 sm:grid sm:grid-cols-2 sm:overflow-visible sm:p-0"
        >
          {extraServices.map((extra, i) => (
            <motion.div
              key={extra.title}
              {...cardMotion(i)}
              className="card-rainbow flex w-[85%] max-w-[22rem] flex-col rounded-2xl border border-sky/15 bg-white p-5 sm:w-auto sm:max-w-none sm:p-6"
            >
              <h3 className="card-rainbow-title text-xl font-medium tracking-tight text-sky">
                {extra.title}
              </h3>
              <p className="mt-1 text-sm font-light text-earth">
                {extra.reference}
              </p>
              <ul className="mt-3 flex-1 space-y-2">
                {extra.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2.5 text-sm font-light leading-relaxed text-sky/70"
                  >
                    <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-earth" />
                    {bullet}
                  </li>
                ))}
              </ul>
              {extra.highlight && (
                <p className="mt-4 rounded-xl bg-sky/[0.06] px-4 py-3 text-sm font-medium leading-relaxed text-sky">
                  {extra.highlight}
                </p>
              )}
            </motion.div>
          ))}
        </SnapRow>
      </div>
    </div>
  );
}
