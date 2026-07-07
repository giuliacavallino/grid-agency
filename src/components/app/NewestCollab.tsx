"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clients, clientSlug, newestCollab } from "@/lib/content";

/** "Newest Collaboration" strip on the homepage: the freshest client's
 * whole gallery drifts by as a full-bleed marquee (same mechanic as the
 * logo band) plus a CTA to the full case page. */
export function NewestCollab() {
  const client = clients.find((c) => c.name === newestCollab);
  if (!client || !client.gallery || client.gallery.length === 0) return null;

  const images = client.gallery;
  const href = `/referenzen/${clientSlug(client.name)}`;

  return (
    <div className="px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -60px 0px" }}
        transition={{ duration: 0.5 }}
        className="flex items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
            Newest Collaboration
          </p>
          <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
            Frisch aus dem{" "}
            <span className="text-scroll-gradient">Ofen</span>.
          </h2>
        </div>
        {client.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logo}
            alt={client.name}
            style={{ height: Math.min((client.height ?? 32) * 1.1, 48) }}
            className="w-auto shrink-0 opacity-90"
          />
        )}
      </motion.div>

      {/* Full-bleed image band, drifting like the logo marquee. Tiles
          have a fixed width so lazily loading images can never change
          the strip width and jolt the loop. */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -60px 0px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative left-1/2 mt-6 w-screen -translate-x-1/2 overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-sky to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-sky to-transparent" />
        <div
          className="marquee flex w-max"
          style={{ "--marquee-duration": `${images.length * 3.2}s` } as React.CSSProperties}
        >
          {[...images, ...images].map((src, i) => (
            <Link
              key={`${src}-${i}`}
              href={href}
              className="mr-3 block aspect-[4/5] w-52 shrink-0 overflow-hidden rounded-2xl sm:w-60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${client.name} — Einblick`}
                loading={i % images.length < 4 ? "eager" : "lazy"}
                className="h-full w-full object-cover"
              />
            </Link>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "0px 0px -40px 0px" }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-5"
      >
        <Link
          href={href}
          className="btn-rainbow flex items-center justify-center gap-2 rounded-full bg-snow py-3 text-sm font-medium text-sky active:scale-[0.97] lg:mx-auto lg:max-w-sm"
        >
          Schau&apos;s dir jetzt an
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </motion.div>
    </div>
  );
}
