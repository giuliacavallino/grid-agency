"use client";

import { useEffect, useState } from "react";

/** Vollflächiger Video-Hintergrund für den Hero: ein stummer 16-Sekunden-
 * Loop aus dem Casa-Beef-Opening-Reel. Hochkant für Handys, Querformat
 * ab Desktop; die Quelle wird erst nach dem Mount gewählt, damit nur
 * eine Datei geladen wird. Bis dahin (und bei reduzierter Bewegung)
 * steht das Poster. */
export function HeroVideo() {
  const [variant, setVariant] = useState<"portrait" | "landscape" | null>(
    null,
  );

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const landscape = window.matchMedia("(min-width: 50rem)");
    const apply = () => setVariant(landscape.matches ? "landscape" : "portrait");
    apply();
    landscape.addEventListener("change", apply);
    return () => landscape.removeEventListener("change", apply);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -top-24 bottom-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden"
    >
      <picture>
        <source media="(min-width: 50rem)" srcSet="/hero/poster-landscape.jpg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/poster-portrait.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </picture>
      {variant && (
        <video
          key={variant}
          className="absolute inset-0 h-full w-full object-cover"
          src={`/hero/loop-${variant}.mp4`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}
      {/* Abdunkeln für lesbare Typo, unten weich in den Seitenhintergrund
          auslaufen, damit das Logo-Band auf festem Grund sitzt. */}
      <div className="absolute inset-0 bg-sky/65" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-sky to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky/70 to-transparent" />
    </div>
  );
}
