"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/** Überdimensionierter Sektionstitel als leise Ebene hinter dem
 * Sektionsanfang, der beim Scrollen leicht seitlich mitläuft. Die
 * umgebende Sektion braucht `relative`. */
export function SectionWatermark({
  word,
  tone = "dark",
}: {
  word: string;
  /** "light" für die weißen Blöcke (dunkle Schrift auf hellem Grund). */
  tone?: "dark" | "light";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["4%", "-6%"]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1 select-none overflow-hidden"
    >
      <motion.span
        style={{ x }}
        className={`block whitespace-nowrap pl-3 text-[6.5rem] font-medium uppercase leading-none tracking-tight lg:text-[12rem] ${
          tone === "light" ? "text-sky/[0.05]" : "text-snow/[0.045]"
        }`}
      >
        {word}
      </motion.span>
    </div>
  );
}
