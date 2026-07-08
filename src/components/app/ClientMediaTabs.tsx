"use client";

import { useState } from "react";
import { GalleryViewer } from "./GalleryViewer";
import type { ClientSection } from "@/lib/content";

type Tab = { title: string; text?: string; images: string[]; video?: string };

/** Category switcher for the client page: instead of stacking every
 * image section into one endless scroll, the categories (Galerie,
 * Events, Behind the Scenes …) become sticky pills that swap the
 * gallery below them instantly. On desktop the block breaks out of
 * the narrow page column so the photos render much larger. */
export function ClientMediaTabs({
  name,
  gallery,
  sections,
}: {
  name: string;
  gallery?: string[];
  sections?: ClientSection[];
}) {
  const tabs: Tab[] = [];
  if (gallery && gallery.length > 0) {
    tabs.push({ title: "Galerie", images: gallery });
  }
  for (const s of sections ?? []) {
    if ((s.images && s.images.length > 0) || s.video) {
      tabs.push({
        title: s.title,
        text: s.text,
        images: s.images ?? [],
        video: s.video,
      });
    }
  }

  const [active, setActive] = useState(0);
  if (tabs.length === 0) return null;
  const tab = tabs[Math.min(active, tabs.length - 1)];

  return (
    <section
      id="galerie"
      className="relative left-1/2 mt-10 w-screen -translate-x-1/2 scroll-mt-24"
    >
      <div className="mx-auto max-w-5xl px-4">
        {tabs.length === 1 ? (
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            {tab.title}
          </h2>
        ) : (
          /* Sticky so the categories stay reachable however deep you scroll. */
          <div className="sticky top-[calc(env(safe-area-inset-top)+68px)] z-30 -mx-4 px-4">
            <div className="glass-dark mx-auto flex w-fit max-w-full gap-2 overflow-x-auto rounded-full p-1.5 [scrollbar-width:none]">
              {tabs.map((t, i) => (
                <button
                  key={t.title}
                  onClick={() => setActive(i)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                    i === active
                      ? "btn-rainbow bg-snow text-sky"
                      : "nav-rainbow text-snow/70"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {tab.text && (
          <p className="mx-auto mt-4 max-w-[34rem] text-center text-sm font-light leading-relaxed text-snow/70 lg:mt-5">
            {tab.text}
          </p>
        )}
        {tab.video && (
          /* Hochformat-Reel: capped height, centered, poster from the
             first photo so the 66-MB-Video erst beim Abspielen lädt. */
          <video
            key={tab.video}
            src={tab.video}
            poster={tab.images[0]}
            controls
            playsInline
            preload="metadata"
            className="mx-auto mt-5 max-h-[78dvh] w-auto max-w-full rounded-2xl"
          />
        )}
        {tab.images.length > 0 && (
          <GalleryViewer
            key={tab.title}
            images={tab.images}
            alt={`${name} — ${tab.title}`}
          />
        )}
      </div>
    </section>
  );
}
