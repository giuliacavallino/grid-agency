"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clients, clientSlug } from "@/lib/content";
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
            <Link
              href={`/projekte/${clientSlug(client.name)}`}
              className="card-rainbow group flex h-full flex-col rounded-2xl border border-snow/10 p-5"
            >
              <div className="flex h-16 items-center">
                {client.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={client.logo}
                    alt={client.name}
                    style={{ height: Math.min((client.height ?? 32) * 1.15, 48) }}
                    className="w-auto max-w-[70%] object-contain opacity-90 transition-transform duration-300 ease-out group-hover:scale-105"
                    loading={i < 8 ? "eager" : "lazy"}
                  />
                ) : (
                  <span className="text-sm font-light uppercase tracking-[0.15em] text-snow/60">
                    {client.name}
                  </span>
                )}
              </div>

              {/* Rubriken: was GRID für dieses Projekt gemacht hat. */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(client.tags ?? ["Social Media Management", "Content Creation"]).map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-snow/15 px-2.5 py-0.5 text-[11px] font-light text-snow/65"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>

              {client.intro && (
                <p className="mt-3 flex-1 text-sm font-light leading-relaxed text-snow/65">
                  {client.intro}
                </p>
              )}

              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-snow/75 transition-colors group-hover:text-snow">
                Projekt ansehen
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
            </Link>
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
