"use client";

import { useEffect, useRef, useState } from "react";

/** Reel im Handy des Heros: Erst steht das Poster (schnelles LCP), das
 * Video lädt nach dem Seitenaufbau und nur, solange es im Bild ist. Kein
 * Video bei reduzierter Bewegung oder Datensparmodus. */
export function HeroVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData) return;
    const start = () => setLoad(true);
    if (document.readyState === "complete") {
      const id = setTimeout(start, 600);
      return () => clearTimeout(id);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (!load || !video) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [load]);

  if (!load) return null;
  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
    />
  );
}
