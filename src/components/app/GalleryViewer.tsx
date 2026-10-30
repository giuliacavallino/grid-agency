"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryImage = { src: string; width: number; height: number };

/** Galerie im Picdrop-Stil: Masonry in Originalformaten, Klick öffnet eine
 * Lightbox mit Pfeilen, Tastatur und Wischen. */
export function GalleryViewer({ images, alt }: { images: GalleryImage[]; alt: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => setIndex((i) => (i === null ? null : (i + delta + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (index === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, step]);

  const current = index === null ? null : images[index];

  return (
    <>
      <div className="mt-6 columns-2 gap-3 lg:columns-3 [&>button]:mb-3">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Bild ${i + 1} ansehen`}
            className="block w-full overflow-hidden rounded-2xl"
          >
            <Image
              src={img.src}
              alt={`${alt}, Bild ${i + 1}`}
              width={img.width}
              height={img.height}
              sizes="(min-width: 800px) 33vw, 50vw"
              loading={i < 4 ? "eager" : "lazy"}
              className="h-auto w-full transition-transform duration-500 hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      {mounted &&
        current &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${alt}, Bild ${index! + 1} von ${images.length}`}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-xl [animation:rise_0.25s_ease_backwards]"
            onClick={close}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (dx < -60) step(1);
              else if (dx > 60) step(-1);
            }}
          >
            <button
              type="button"
              aria-label="Schließen"
              onClick={close}
              className="glass absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] z-10 flex h-11 w-11 items-center justify-center rounded-full text-snow active:scale-90"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
            <span className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+28px)] -translate-x-1/2 text-xs font-light tracking-widest text-snow/60">
              {index! + 1} / {images.length}
            </span>
            <button
              type="button"
              aria-label="Vorheriges Bild"
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              className="glass absolute left-3 z-10 hidden h-12 w-12 items-center justify-center rounded-full text-snow active:scale-90 sm:flex lg:left-6"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
            <Image
              key={current.src}
              src={current.src}
              alt={`${alt}, Bild ${index! + 1}`}
              width={current.width}
              height={current.height}
              sizes="94vw"
              priority
              onClick={(e) => e.stopPropagation()}
              className="h-auto max-h-[86dvh] w-auto max-w-[94vw] rounded-2xl object-contain [animation:rise_0.3s_var(--ease-spring)_backwards]"
            />
            <button
              type="button"
              aria-label="Nächstes Bild"
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              className="glass absolute right-3 z-10 hidden h-12 w-12 items-center justify-center rounded-full text-snow active:scale-90 sm:flex lg:right-6"
            >
              <ChevronRight className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
