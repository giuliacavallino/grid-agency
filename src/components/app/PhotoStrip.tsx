"use client";

import Link from "next/link";
import { motion } from "framer-motion";

/** Foto-Streifen auf voller Breite: die stärksten Shots aus echten
 * Produktionen driften wie das Logo-Band vorbei. Feste Höhe und feste
 * Seitenverhältnisse, damit lazy geladene Bilder die Streifenbreite nie
 * verändern und der Loop sauber bleibt. */
const shots: { src: string; href: string; alt: string; wide?: boolean }[] = [
  { src: "/referenzen/480-gradi/21.webp", href: "/projekte/480-gradi", alt: "480 GRADI, Pizza am Tisch", wide: true },
  { src: "/referenzen/casa-beef/events-12.webp", href: "/projekte/casa-beef", alt: "Casa Beef, Opening" },
  { src: "/referenzen/480-gradi/30.webp", href: "/projekte/480-gradi", alt: "480 GRADI, Pizzaschneider" },
  { src: "/referenzen/casa-beef/14.webp", href: "/projekte/casa-beef", alt: "Casa Beef, Gericht", wide: true },
  { src: "/referenzen/casa-beef/events-3.webp", href: "/projekte/casa-beef", alt: "Casa Beef, Gäste" },
  { src: "/referenzen/480-gradi/12.webp", href: "/projekte/480-gradi", alt: "480 GRADI, Pizza aus dem Ofen" },
  { src: "/referenzen/casa-beef/bts-2.webp", href: "/projekte/casa-beef", alt: "Casa Beef, Behind the Scenes", wide: true },
  { src: "/referenzen/480-gradi/55.webp", href: "/projekte/480-gradi", alt: "480 GRADI, Pistazien-Pizza" },
  { src: "/referenzen/casa-beef/events-30.webp", href: "/projekte/casa-beef", alt: "Casa Beef, Service am Tisch" },
  { src: "/referenzen/480-gradi/26.webp", href: "/projekte/480-gradi", alt: "480 GRADI, Pizza servieren", wide: true },
];

export function PhotoStrip() {
  return (
    <div className="py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
        className="px-5"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Aus unseren Produktionen
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Content, der <span className="text-scroll-gradient">Appetit</span>{" "}
          macht.
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative left-1/2 mt-8 w-screen -translate-x-1/2 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-sky to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-sky to-transparent" />
        <div
          className="marquee flex w-max items-stretch [&:hover]:[animation-play-state:paused]"
          style={{ "--marquee-duration": `${shots.length * 5}s` } as React.CSSProperties}
        >
          {[...shots, ...shots].map((shot, i) => (
            <Link
              key={`${shot.src}-${i}`}
              href={shot.href}
              className={`mr-3 block h-56 shrink-0 overflow-hidden rounded-2xl lg:mr-4 lg:h-80 ${
                shot.wide ? "aspect-[4/3]" : "aspect-[4/5]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={shot.alt}
                loading={i % shots.length < 4 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
