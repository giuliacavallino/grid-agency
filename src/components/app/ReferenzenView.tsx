"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { clients, clientSlug } from "@/lib/content";
import { stashScrollTarget } from "@/lib/scroll";

export function ReferenzenView() {
  return (
    <div className="px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Referenzen
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Marken, die uns
          <br />
          ihren <span className="text-scroll-gradient">Feed</span> anvertrauen.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm font-light leading-relaxed text-snow/60">
          {clients.length} Brands aus Berlin, Frankfurt und darüber hinaus.
          Tippe auf ein Logo für Case, Galerie und Einblicke.
        </p>
      </motion.div>

      {/* Standalone logos, no tiles: hover zooms, click goes straight
          to the client page — no preview sheet in between. */}
      <div className="mt-10 grid grid-cols-2 items-center gap-x-6 gap-y-10 sm:grid-cols-3">
        {clients.map((client, i) => (
          <motion.div
            key={client.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.5) }}
          >
            <Link
              href={`/referenzen/${clientSlug(client.name)}`}
              aria-label={client.name}
              className="group flex items-center justify-center p-2"
            >
              {client.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={client.logo}
                  alt={client.name}
                  style={{ height: Math.min((client.height ?? 32) * 1.2, 52) }}
                  className="max-w-full w-auto object-contain opacity-90 transition-transform duration-300 ease-out group-hover:scale-110 group-active:scale-95"
                  loading={i < 12 ? "eager" : "lazy"}
                />
              ) : (
                <span className="text-center text-xs font-light uppercase tracking-[0.15em] text-snow/50 transition-transform duration-300 group-hover:scale-110">
                  {client.name}
                </span>
              )}
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
