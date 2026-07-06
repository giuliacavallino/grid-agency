"use client";

import { motion } from "framer-motion";
import { Compass, CalendarDays, Camera, Scissors } from "lucide-react";

const services = [
  {
    icon: Compass,
    title: "Strategy & Set-up",
    description:
      "Einrichtung eurer Social-Media-Kanäle, Zieldefinition und Entwicklung einer Content-Strategie inklusive Tonalität, Themen und Analyse-Tools.",
  },
  {
    icon: CalendarDays,
    title: "Strategische Betreuung",
    description:
      "Wöchentliche Strategie-Calls, laufende Content-Planung, Briefings für Team und Creator sowie Trend- und Benchmark-Scanning.",
  },
  {
    icon: Camera,
    title: "Content Day Produktion",
    description:
      "Koordination und Regie vor Ort — von der Shotlist bis zur Umsetzung mit Videograf:innen oder eurem eigenen Team.",
  },
  {
    icon: Scissors,
    title: "Editing & Postproduction",
    description:
      "Schnitt eures Rohmaterials mit Untertiteln, Musik und Hook-Editing — fertig für Instagram, TikTok und LinkedIn.",
  },
];

export function Services() {
  return (
    <section id="leistungen" className="border-b border-snow/10 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-dune">
            Leistungen
          </p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight text-snow md:text-5xl">
            Alles, was eure Marke im Grid braucht.
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl bg-snow/10 sm:grid-cols-2">
          {services.map((service, i) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group bg-sky p-8 transition-colors hover:bg-earth/20 md:p-10"
            >
              <service.icon
                className="h-8 w-8 text-dune transition-colors group-hover:text-snow"
                strokeWidth={1.5}
              />
              <h3 className="mt-6 text-xl font-medium text-snow">
                {service.title}
              </h3>
              <p className="mt-3 text-sm font-light leading-relaxed text-snow/60">
                {service.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
