"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "6.000+", label: "Accounts erreicht / Monat" },
  { value: "2", label: "Standorte — Berlin & Frankfurt" },
  { value: "15+", label: "Betreute Marken" },
  { value: "100%", label: "Fokus auf Social Media" },
];

export function Stats() {
  return (
    <section className="border-y border-snow/10 bg-sky">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-16 md:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <p className="text-3xl font-medium text-snow md:text-4xl">
              {stat.value}
            </p>
            <p className="mt-2 text-sm font-light text-snow/60">
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
