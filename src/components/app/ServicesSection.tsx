"use client";

import { motion } from "framer-motion";
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
 * Leistungsspektrum als Blöcke, darunter die Zusatzleistungen. */
export function ServicesSection() {
  return (
    <div className="px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Leistungen
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Unsere Services.
          <br />
          <span className="text-scroll-gradient">Deine Lösung</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-snow/65">
          Social Media für Gastronomie und Food. Unser Schwerpunkt sind Marken
          mit mehreren Standorten, die trotz ihrer Größe familiengeführt sind.
          Unsere Kanalarbeit endet nicht beim Posting, sie ist an konkrete
          Geschäftsziele gekoppelt, vor allem an Mitarbeitergewinnung und
          lokale Sichtbarkeit.
        </p>
      </motion.div>

      <div className="mt-8 space-y-4">
        {services.map((service, i) => (
          <motion.div
            key={service.number}
            {...cardMotion(i)}
            className="card-rainbow relative overflow-hidden rounded-2xl border border-snow/10 p-5 sm:p-6"
          >
            <span className="pointer-events-none absolute -right-3 -top-6 text-[5.5rem] font-medium leading-none text-snow/[0.06]">
              {service.number}
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dune">
              {service.number}
            </p>
            <h3 className="card-rainbow-title mt-2 text-xl font-medium tracking-tight text-snow">
              {service.title}
              {service.accent && (
                <>
                  {" "}
                  <span className="card-rainbow-title text-scroll-gradient">
                    {service.accent}
                  </span>
                </>
              )}
            </h3>
            <p className="mt-1 text-sm font-medium text-snow/85">
              {service.tagline}
            </p>
            <ul className="mt-3 space-y-2">
              {service.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/65"
                >
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-dune" />
                  {bullet}
                </li>
              ))}
            </ul>
            {service.highlight && (
              <p className="mt-4 rounded-xl bg-snow/[0.06] px-4 py-3 text-sm font-medium leading-relaxed text-snow">
                {service.highlight}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="mt-10 text-xs font-medium uppercase tracking-[0.2em] text-dune"
      >
        Zusatzleistungen
      </motion.p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {extraServices.map((extra, i) => (
          <motion.div
            key={extra.title}
            {...cardMotion(i)}
            className="card-rainbow flex flex-col rounded-2xl border border-snow/10 p-5 sm:p-6"
          >
            <h3 className="card-rainbow-title text-xl font-medium tracking-tight text-snow">
              {extra.title}
            </h3>
            <p className="mt-1 text-sm font-light text-dune">
              {extra.reference}
            </p>
            <ul className="mt-3 flex-1 space-y-2">
              {extra.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/65"
                >
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-dune" />
                  {bullet}
                </li>
              ))}
            </ul>
            {extra.highlight && (
              <p className="mt-4 rounded-xl bg-snow/[0.06] px-4 py-3 text-sm font-medium leading-relaxed text-snow">
                {extra.highlight}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
