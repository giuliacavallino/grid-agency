"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clients, clientSlug, newestCollab } from "@/lib/content";

/** "Newest Collaboration" strip on the homepage: a few gallery shots
 * of the freshest client plus a CTA to the full case page. */
export function NewestCollab() {
  const client = clients.find((c) => c.name === newestCollab);
  if (!client || !client.gallery || client.gallery.length === 0) return null;

  const preview = client.gallery.slice(0, 5);
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

      {/* IG-carousel feel: horizontal snap scroll, edges peeking. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -60px 0px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]"
      >
        {preview.map((src, i) => (
          <Link
            key={src}
            href={href}
            className="relative aspect-[4/5] w-[68%] shrink-0 snap-center overflow-hidden rounded-2xl sm:w-[42%] lg:w-[30%]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`${client.name} — Einblick ${i + 1}`}
              loading={i < 2 ? "eager" : "lazy"}
              className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.04]"
            />
          </Link>
        ))}
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
