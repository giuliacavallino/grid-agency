"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { clients } from "@/lib/content";
import { ProjektCard } from "./ProjektCard";
import { stashScrollTarget } from "@/lib/scroll";

/** Projektübersicht: jedes Projekt als Karte mit Logo, Rubriken-Chips
 * (was GRID dafür gemacht hat) und Kurzbeschreibung, verlinkt auf die
 * Projektseite. */
export function ProjekteView() {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Projekte
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Marken, die uns
          <br />
          ihren <span className="text-scroll-gradient">Feed</span> anvertrauen.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm font-light leading-relaxed text-snow/60">
          {clients.length} Brands aus Berlin, Frankfurt und darüber hinaus.
          Tippe auf ein Projekt für Case, Galerie und Einblicke.
        </p>
      </motion.div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {clients.map((client, i) => (
          <motion.div
            key={client.name}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: Math.min(i * 0.04, 0.6) }}
          >
            <ProjektCard client={client} eager={i < 8} />
          </motion.div>
        ))}
      </div>

      <p className="mt-12 text-center text-sm font-light text-snow/50">
        Deine Marke fehlt hier noch?{" "}
        <Link
          href="/"
          onClick={() => stashScrollTarget("dm")}
          className="font-medium text-dune underline-offset-4 hover:underline"
        >
          Lass uns reden →
        </Link>
      </p>
    </div>
  );
}
