"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Heart, MessageCircle, Music2, Send } from "lucide-react";
import { reels, type Reel } from "@/lib/content";

function ReelCard({ reel }: { reel: Reel }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Parallax: text drifts up as the reel passes through the viewport.
  const y = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.25, 0.75, 1],
    [0, 1, 1, 0]
  );
  const patternY = useTransform(scrollYProgress, [0, 1], ["-12%", "12%"]);

  return (
    <div
      ref={ref}
      className="relative flex h-[88vh] snap-start items-center overflow-hidden rounded-2xl border border-snow/10"
    >
      <motion.div
        style={{ y: patternY }}
        className="grid-pattern-bg pointer-events-none absolute inset-0 scale-125 opacity-[0.12]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky/0 via-sky/0 to-sky/70" />

      <motion.div style={{ y, opacity }} className="relative z-10 px-6">
        <span className="inline-block rounded-full border border-snow/25 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.25em] text-snow/70">
          {reel.tag}
        </span>
        <h3 className="mt-4 text-[3.25rem] font-medium leading-[0.95] tracking-tight text-snow">
          {reel.line1}
          <br />
          <span className="italic text-dune">{reel.line2}</span>
        </h3>
        <p className="mt-4 max-w-[18rem] text-base font-light leading-relaxed text-snow/70">
          {reel.sub}
        </p>
      </motion.div>

      <div className="absolute bottom-8 right-4 z-10 flex flex-col items-center gap-5 text-snow">
        <div className="flex flex-col items-center gap-1">
          <Heart className="h-7 w-7" strokeWidth={1.8} />
          <span className="text-[11px] font-light">2030</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7" strokeWidth={1.8} />
          <span className="text-[11px] font-light">∞</span>
        </div>
        <Send className="h-7 w-7" strokeWidth={1.8} />
      </div>

      <div className="absolute bottom-8 left-6 z-10 flex items-center gap-2 text-snow/70">
        <Music2 className="h-4 w-4" strokeWidth={1.8} />
        <span className="text-[11px] font-light">
          GRID Original Audio · zwei Schritte voraus
        </span>
      </div>
    </div>
  );
}

export function ReelsSection() {
  return (
    <div className="px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Reels
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow">
          Vision 2030.
        </h2>
        <p className="mt-2 text-sm font-light text-snow/55">
          Scroll dich durch die Zukunft. ↓
        </p>
      </motion.div>

      <div className="no-scrollbar mt-6 h-[88vh] snap-y snap-mandatory space-y-4 overflow-y-auto rounded-2xl">
        {reels.map((reel) => (
          <ReelCard key={reel.id} reel={reel} />
        ))}
      </div>
    </div>
  );
}
