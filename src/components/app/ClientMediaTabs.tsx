"use client";

import { useState } from "react";
import { GalleryViewer, type GalleryImage } from "./GalleryViewer";

export type MediaTab = { title: string; text?: string; images: GalleryImage[]; video?: string };

/** Kategorien der Projektseite (Galerie, Events, Behind the Scenes …) als
 * klebende Pillen, die die Galerie darunter sofort tauschen. */
export function ClientMediaTabs({ name, tabs }: { name: string; tabs: MediaTab[] }) {
  const [active, setActive] = useState(0);
  if (tabs.length === 0) return null;
  const tab = tabs[Math.min(active, tabs.length - 1)];

  return (
    <section id="galerie" className="mt-16 scroll-mt-28 lg:mt-24">
      {tabs.length === 1 ? (
        <span className="eyebrow">{tab.title}</span>
      ) : (
        <div className="sticky top-[calc(env(safe-area-inset-top)+80px)] z-30 lg:top-24">
          <div role="tablist" aria-label="Kategorien" className="glass mx-auto flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none]">
            {tabs.map((t, i) => (
              <button
                key={t.title}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  i === active ? "bg-snow text-sky" : "text-snow/70 hover:text-snow"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {tab.text && <p className="mx-auto mt-6 max-w-xl text-center text-sm font-light leading-relaxed text-snow/70">{tab.text}</p>}
      {tab.video && (
        // Hochformat-Reel: Poster aus dem ersten Foto, das Video lädt erst beim Abspielen.
        <video
          key={tab.video}
          src={tab.video}
          poster={tab.images[0]?.src}
          controls
          playsInline
          preload="none"
          className="mx-auto mt-6 max-h-[78dvh] w-auto max-w-full rounded-[1.5rem]"
        />
      )}
      {tab.images.length > 0 && <GalleryViewer key={tab.title} images={tab.images} alt={`${name}, ${tab.title}`} />}
    </section>
  );
}
