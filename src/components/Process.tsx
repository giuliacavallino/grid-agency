"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "Kennenlernen",
    description:
      "Im kostenlosen Erstgespräch lernen wir eure Marke, Ziele und Zielgruppe kennen.",
  },
  {
    number: "02",
    title: "Strategie",
    description:
      "Wir entwickeln Content-Pillars, Tonalität und eine Roadmap für eure Kanäle.",
  },
  {
    number: "03",
    title: "Produktion",
    description:
      "Content Days, Editing und Storytelling — abgestimmt in wöchentlichen Calls.",
  },
  {
    number: "04",
    title: "Wachstum",
    description:
      "Laufendes Performance-Tracking, Trend-Scanning und stetige Optimierung.",
  },
];

export function Process() {
  return (
    <section id="prozess" className="border-b border-snow/10 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-dune">
            Prozess
          </p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight text-snow md:text-5xl">
            So arbeiten wir mit euch.
          </h2>
        </motion.div>

        <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="border-t border-snow/20 pt-6"
            >
              <span className="text-sm font-medium text-dune">
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-medium text-snow">
                {step.title}
              </h3>
              <p className="mt-2 text-sm font-light leading-relaxed text-snow/60">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
