"use client";

import { motion } from "framer-motion";
import { services } from "@/lib/content";

/** "Leistungen" auf der Homepage: die vier Kernservices aus der
 * Agentur-Präsentation als 2x2-Kartenraster (mobil untereinander). */
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
        <p className="mt-4 max-w-xl text-sm font-light leading-relaxed text-snow/65">
          In einer immer schnelleren, vernetzteren Welt sorgen wir dafür, dass
          deine Marke auf allen Kanälen einen bleibenden Eindruck hinterlässt.
        </p>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {services.map((service, i) => (
          <motion.div
            key={service.accent}
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{
              duration: 0.55,
              delay: i * 0.06,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="card-rainbow rounded-2xl border border-snow/10 p-5"
          >
            <h3 className="card-rainbow-title text-xl font-medium tracking-tight text-snow">
              {service.title}{" "}
              <span className="card-rainbow-title text-scroll-gradient">
                {service.accent}
              </span>
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
              {service.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
