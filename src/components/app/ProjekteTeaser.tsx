"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clients } from "@/lib/content";
import { ProjektCard } from "./ProjektCard";
import { SectionWatermark } from "./SectionWatermark";

/** Projektübersicht auf der Startseite: die Vorzeigeprojekte (Kunden
 * mit eigenen Rubriken) als Karten, mit Link auf alle Projekte. */
export function ProjekteTeaser() {
  const featured = clients.filter((c) => c.tags).slice(0, 6);

  return (
    <div className="relative px-5 py-12">
      <SectionWatermark word="Projekte" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Projekte
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Marken, die uns ihren
          <br />
          <span className="text-scroll-gradient">Feed</span> anvertrauen.
        </h2>
      </motion.div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((client, i) => (
          <motion.div
            key={client.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
          >
            <ProjektCard client={client} eager={i < 3} />
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.5 }}
        className="mt-8 flex justify-center"
      >
        <Link
          href="/projekte"
          className="glass flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-medium text-snow transition-all active:scale-[0.97]"
        >
          Alle Projekte ansehen
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </motion.div>
    </div>
  );
}
