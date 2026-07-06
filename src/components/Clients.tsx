"use client";

import { motion } from "framer-motion";

const clients = [
  "Casa Beef",
  "Huck",
  "Polly",
  "Green & Protein",
  "Shiso Burger",
  "StoneX",
  "480 GRADI",
  "Kindly",
  "Coffi",
  "Friendly Fish",
];

export function Clients() {
  const row = [...clients, ...clients];

  return (
    <section id="arbeiten" className="border-b border-snow/10 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-sm font-medium uppercase tracking-[0.2em] text-dune">
          Serving the coolest brands
        </p>
      </div>

      <div className="relative mt-10 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-sky to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-sky to-transparent" />

        <motion.div
          className="flex w-max gap-16 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {row.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="text-3xl font-light text-snow/30 transition-colors hover:text-snow/70 md:text-4xl"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
