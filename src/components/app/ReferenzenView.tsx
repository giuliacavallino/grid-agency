"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Camera, X } from "lucide-react";
import { clients, type Client } from "@/lib/content";

/** lucide dropped brand icons, so the Instagram glyph lives here. */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ClientSheet({
  client,
  onClose,
}: {
  client: Client;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-sky/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 90 || info.velocity.y > 600) onClose();
        }}
        className="glass fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-snow/25" />

        <button
          aria-label="Schließen"
          onClick={onClose}
          className="glass absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-snow"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <div className="flex min-h-24 items-center justify-center py-4">
          {client.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.logo}
              alt={client.name}
              style={{ height: Math.min((client.height ?? 32) * 1.6, 72) }}
              className="w-auto"
            />
          ) : (
            <span className="text-xl font-light uppercase tracking-[0.2em] text-snow/70">
              {client.name}
            </span>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-snow">
          {client.name}
          <BadgeCheck className="h-4 w-4 text-dune" strokeWidth={2} />
        </p>

        {client.instagram ? (
          <a
            href={`https://www.instagram.com/${client.instagram}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 rounded-full bg-snow py-3 text-sm font-medium text-sky transition-all active:scale-[0.97]"
          >
            <InstagramIcon className="h-4 w-4" />
            @{client.instagram}
          </a>
        ) : (
          <p className="mt-5 text-center text-xs font-light text-snow/40">
            Instagram-Link folgt
          </p>
        )}

        <div className="mt-7">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Galerie
          </p>
          {client.gallery && client.gallery.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {client.gallery.map((src) => (
                <div
                  key={src}
                  className="relative aspect-square overflow-hidden rounded-xl"
                >
                  <Image
                    src={src}
                    alt={client.name}
                    fill
                    sizes="(max-width: 560px) 33vw, 180px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-snow/15 py-10">
              <Camera className="h-5 w-5 text-snow/30" strokeWidth={1.6} />
              <p className="text-xs font-light text-snow/40">
                Einblicke folgen in Kürze.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

export function ReferenzenView() {
  const [active, setActive] = useState<Client | null>(null);

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
          ihren Feed anvertrauen.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm font-light leading-relaxed text-snow/60">
          {clients.length} Brands aus Berlin, Frankfurt und darüber hinaus.
          Tippe auf ein Logo für Einblicke und den direkten Weg zum Kanal.
        </p>
      </motion.div>

      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {clients.map((client, i) => (
          <motion.button
            key={client.name}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.03, 0.5) }}
            onClick={() => setActive(client)}
            aria-label={client.name}
            className="glass relative flex aspect-[4/3] items-center justify-center rounded-2xl p-4 transition-all active:scale-[0.96]"
          >
            {client.instagram && (
              <InstagramIcon className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-snow/30" />
            )}
            {client.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={client.logo}
                alt={client.name}
                style={{ height: Math.min((client.height ?? 32) * 1.25, 52) }}
                className="max-w-full w-auto object-contain opacity-90"
                loading={i < 12 ? "eager" : "lazy"}
              />
            ) : (
              <span className="text-center text-xs font-light uppercase tracking-[0.15em] text-snow/50">
                {client.name}
              </span>
            )}
          </motion.button>
        ))}
      </div>

      <p className="mt-10 text-center text-sm font-light text-snow/50">
        Deine Marke fehlt hier noch?{" "}
        <Link
          href="/#dm"
          className="font-medium text-dune underline-offset-4 hover:underline"
        >
          Lass uns reden →
        </Link>
      </p>

      <AnimatePresence>
        {active && (
          <ClientSheet client={active} onClose={() => setActive(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
