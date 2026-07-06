"use client";

import { motion } from "framer-motion";

type SectionPlaceholderProps = {
  kicker: string;
  title: string;
  variant: "feed" | "reels";
};

export function SectionPlaceholder({
  kicker,
  title,
  variant,
}: SectionPlaceholderProps) {
  return (
    <div className="px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          {kicker}
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow">
          {title}
        </h2>
      </motion.div>

      {variant === "feed" ? (
        <div className="mt-6 space-y-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-snow/10"
            >
              <div className="flex items-center gap-2.5 p-3">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="skeleton h-3 w-28 rounded" />
              </div>
              <div className="skeleton aspect-square w-full" />
              <div className="space-y-2 p-3">
                <div className="skeleton h-3 w-40 rounded" />
                <div className="skeleton h-3 w-56 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-scrollbar mt-6 flex gap-3 overflow-x-auto pb-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skeleton aspect-[9/16] w-40 shrink-0 rounded-xl"
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-center text-xs font-light text-snow/35">
        Lädt aus 2030 …
      </p>
    </div>
  );
}
