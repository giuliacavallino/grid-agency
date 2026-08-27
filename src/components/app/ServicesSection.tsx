"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { extraServices, services } from "@/lib/content";

const cardMotion = (i: number) => ({
  initial: { opacity: 0, y: 28, scale: 0.97 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  viewport: { once: true, margin: "-70px" },
  transition: {
    duration: 0.55,
    delay: i * 0.06,
    ease: [0.16, 1, 0.3, 1] as const,
  },
});

/** "Leistungen" auf der Homepage: die fünf Leistungsbereiche aus dem
 * Leistungsspektrum als Timeline mit Akkordeon, darunter die
 * Zusatzleistungen. Bewusst als heller Block (Snow auf voller Breite),
 * damit die Seite zwischen Dunkel und Hell atmet. */
export function ServicesSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 bg-snow text-sky">
      <div className="mx-auto w-full max-w-frame px-5 py-12 lg:max-w-frame-lg">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-earth">
            Leistungen
          </p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight text-sky">
            Unsere Services.
            <br />
            <span className="text-scroll-gradient-strong">Deine Lösung</span>.
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-sky/70">
            Social Media für Gastronomie und Food. Unser Schwerpunkt sind
            Marken mit mehreren Standorten, die trotz ihrer Größe
            familiengeführt sind. Unsere Kanalarbeit endet nicht beim Posting,
            sie ist an konkrete Geschäftsziele gekoppelt, vor allem an
            Mitarbeitergewinnung und lokale Sichtbarkeit.
          </p>
        </motion.div>

        {/* Die fünf Bereiche als Timeline: erst Setup, dann Strategie usw.,
            verbunden über eine Leiste mit nummerierten Stationen. */}
        <div className="mt-8">
          {services.map((service, i) => (
            <motion.div
              key={service.number}
              {...cardMotion(i)}
              className="relative flex gap-4 pb-4 last:pb-0 sm:gap-5"
            >
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky text-xs font-medium text-snow">
                  {service.number}
                </span>
                {i < services.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-sky/15" />
                )}
              </div>
              {/* Akkordeon: standardmäßig nur Titel + Tagline, Details per
                  Tap. So bleibt die Startseite kurz, ohne Inhalte zu
                  verlieren. */}
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="card-rainbow relative mb-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-sky/10 bg-white/50 p-5 text-left sm:p-6"
              >
                <span className="pointer-events-none absolute -right-3 -top-6 text-[5.5rem] font-medium leading-none text-sky/[0.05]">
                  {service.number}
                </span>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="card-rainbow-title text-xl font-medium tracking-tight text-sky">
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
                    <p className="mt-1 text-sm font-medium text-sky/85">
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
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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
              </button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-10 text-xs font-medium uppercase tracking-[0.2em] text-earth"
        >
          Zusatzleistungen
        </motion.p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {extraServices.map((extra, i) => (
            <motion.div
              key={extra.title}
              {...cardMotion(i)}
              className="card-rainbow flex flex-col rounded-2xl border border-sky/10 bg-white/50 p-5 sm:p-6"
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
        </div>
      </div>
    </div>
  );
}
