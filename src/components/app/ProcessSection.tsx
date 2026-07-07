"use client";

import { motion } from "framer-motion";
import { processSteps } from "@/lib/content";

export function ProcessSection() {
  return (
    <div className="px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Prozess
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          So bauen wir deinen
          <br />
          <span className="text-scroll-gradient">unfairen Vorteil</span>.
        </h2>
      </motion.div>

      <div className="mt-8 space-y-4">
        {processSteps.map((step, i) => (
          <motion.div
            key={step.number}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{
              duration: 0.55,
              delay: i * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative overflow-hidden rounded-2xl border border-snow/10 p-5"
          >
            <span className="pointer-events-none absolute -right-3 -top-6 text-[5.5rem] font-medium leading-none text-snow/[0.06]">
              {step.number}
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dune">
              {step.number} — {step.title}
            </p>
            <h3 className="mt-2 text-xl font-medium tracking-tight text-snow">
              {step.claim}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
              {step.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
