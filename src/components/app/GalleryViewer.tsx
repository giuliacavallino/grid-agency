"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/** Picdrop-style gallery: click opens a fullscreen lightbox with
 * arrow/keyboard navigation. `masonry` (default) shows large images at
 * their natural aspect ratio; `grid` shows compact square thumbnails
 * (used inside the client sheet). */
export function GalleryViewer({
  images,
  alt,
  variant = "masonry",
}: {
  images: string[];
  alt: string;
  variant?: "masonry" | "grid";
}) {
  const [index, setIndex] = useState<number | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const close = useCallback(() => setIndex(null), []);
  const step = useCallback(
    (delta: number) => {
      setIndex((i) =>
        i === null ? null : (i + delta + images.length) % images.length,
      );
    },
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

  return (
    <>
      {variant === "masonry" ? (
        /* Large masonry columns keep each photo's own aspect ratio. */
        <div className="mt-4 columns-1 gap-3 sm:columns-2 [&>button]:mb-3">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIndex(i)}
              aria-label={`Bild ${i + 1} ansehen`}
              className="block w-full overflow-hidden rounded-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${alt} — Bild ${i + 1}`}
                loading={i < 4 ? "eager" : "lazy"}
                className="w-full transition-transform duration-300 ease-out hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      ) : (
        /* Compact square thumbnails for tight spaces like the sheet. */
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIndex(i)}
              aria-label={`Bild ${i + 1} ansehen`}
              className="aspect-square overflow-hidden rounded-xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${alt} — Bild ${i + 1}`}
                loading={i < 9 ? "eager" : "lazy"}
                className="h-full w-full object-cover transition-transform duration-300 ease-out hover:scale-[1.05]"
              />
            </button>
          ))}
        </div>
      )}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {index !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95"
                onClick={close}
              >
                <button
                  aria-label="Schließen"
                  onClick={close}
                  className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-snow/10 text-snow backdrop-blur transition-transform active:scale-90"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>

                <span className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+26px)] -translate-x-1/2 text-xs font-light tracking-widest text-snow/60">
                  {index + 1} / {images.length}
                </span>

                <button
                  aria-label="Vorheriges Bild"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                  className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-snow/10 text-snow backdrop-blur transition-transform active:scale-90 lg:left-6"
                >
                  <ChevronLeft className="h-6 w-6" strokeWidth={2} />
                </button>

                <motion.img
                  key={images[index]}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  src={images[index]}
                  alt={`${alt} — Bild ${index + 1}`}
                  onClick={(e) => e.stopPropagation()}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70) step(1);
                    else if (info.offset.x > 70) step(-1);
                  }}
                  className="max-h-[86dvh] max-w-[94vw] rounded-lg object-contain"
                />

                <button
                  aria-label="Nächstes Bild"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-snow/10 text-snow backdrop-blur transition-transform active:scale-90 lg:right-6"
                >
                  <ChevronRight className="h-6 w-6" strokeWidth={2} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
