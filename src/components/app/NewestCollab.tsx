"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { clients, clientSlug, newestCollab } from "@/lib/content";

const TILE_VISIBILITY = ["", "hidden sm:block", "hidden lg:block"];

/** One auto-cycling tile of the slideshow: crossfades to the next
 * image whenever its `src` changes. */
function SlideTile({
  src,
  href,
  alt,
  order,
}: {
  src: string;
  href: string;
  alt: string;
  order: number;
}) {
  return (
    <Link
      href={href}
      className={`relative aspect-[4/5] overflow-hidden rounded-2xl ${TILE_VISIBILITY[order]}`}
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={src}
          src={src}
          alt={alt}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeOut", delay: order * 0.15 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
    </Link>
  );
}

/** "Newest Collaboration" strip on the homepage: an automatically
 * cycling slideshow through the freshest client's whole gallery plus
 * a CTA to the full case page. */
export function NewestCollab() {
  const client = clients.find((c) => c.name === newestCollab);
  const gallery = client?.gallery;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!gallery || gallery.length < 2) return;
    const timer = setInterval(() => setTick((n) => n + 1), 3800);
    return () => clearInterval(timer);
  }, [gallery]);

  // Warm the cache for the upcoming slides so the crossfade never
  // fades into a still-loading image.
  useEffect(() => {
    if (!gallery || gallery.length < 2) return;
    const step = Math.ceil(gallery.length / 3);
    for (let k = 0; k < 3; k++) {
      const img = new window.Image();
      img.src = gallery[(tick + 1 + k * step) % gallery.length];
    }
  }, [tick, gallery]);

  if (!client || !gallery || gallery.length === 0) return null;
  const images = gallery;

  const href = `/referenzen/${clientSlug(client.name)}`;
  const step = Math.ceil(images.length / 3);

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

      {/* Hands-free slideshow: each tile crossfades through its own
       * third of the gallery, so together they cycle every image. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -60px 0px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[0, 1, 2].map((k) => (
          <SlideTile
            key={k}
            src={images[(tick + k * step) % images.length]}
            href={href}
            alt={`${client.name} — Einblick`}
            order={k}
          />
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
