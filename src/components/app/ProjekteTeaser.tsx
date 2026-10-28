"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clients } from "@/lib/content";
import { ProjektCard } from "./ProjektCard";
import { SectionWatermark } from "./SectionWatermark";
import { SnapRow } from "./SnapRow";

/** Projektübersicht auf der Startseite: die Vorzeigeprojekte (Kunden
 * mit eigenen Rubriken) als Wisch-Reihe, damit die Sektion auf jedem
 * Format in einen Bildschirm passt, mit Link auf alle Projekte. */
export function ProjekteTeaser() {
  const featured = clients.filter((c) => c.tags).slice(0, 6);

  return (
    <div className="screen px-5 lg:px-gutter">
      <SectionWatermark word="Projekte" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Projekte
          </p>
          {/* Mobil oben rechts statt Button unter der Reihe: spart Höhe. */}
          <Link
            href="/projekte"
            className="text-sm font-medium text-dune underline-offset-4 hover:underline lg:hidden"
          >
            Alle ansehen →
          </Link>
        </div>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow lg:text-4xl">
          Marken, die uns ihren
          <br />
          <span className="text-scroll-gradient">Feed</span> anvertrauen.
        </h2>
      </motion.div>

      <SnapRow
        label="Projekte"
        arrows
        controlsAbove
        className="mt-6 items-stretch lg:mt-8"
        footer={
          <Link
            href="/projekte"
            className="glass hidden items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-medium text-snow transition-all active:scale-[0.97] lg:flex"
          >
            Alle Projekte ansehen
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      >
        {featured.map((client, i) => (
          <motion.div
            key={client.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-70px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className="w-[82%] max-w-[22rem] sm:w-[calc((100%-0.75rem)/2.2)] sm:max-w-none lg:w-[calc((100%-3rem)/3.3)] min-[1800px]:w-[calc((100%-4rem)/4.3)]"
          >
            <ProjektCard client={client} eager={i < 3} compact />
          </motion.div>
        ))}
      </SnapRow>
    </div>
  );
}
