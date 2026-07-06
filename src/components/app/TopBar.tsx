"use client";

import Image from "next/image";
import { Heart, Send } from "lucide-react";
import { motion } from "framer-motion";

export function TopBar() {
  return (
    <motion.header
      initial={{ y: -72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed top-0 z-40 w-full max-w-[560px] px-5 pt-[calc(env(safe-area-inset-top)+12px)]"
    >
      <div className="glass pointer-events-auto relative mx-auto flex h-12 max-w-[400px] items-center justify-between overflow-hidden rounded-full px-5">
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />
        <a href="#profil" aria-label="Nach oben" className="relative">
          <Image
            src="/brand/grid_logo_snow.png"
            alt="GRID"
            width={72}
            height={19}
            priority
          />
        </a>
        <div className="relative flex items-center gap-5">
          <button
            aria-label="Aktivität"
            className="relative text-snow transition-transform active:scale-90"
          >
            <Heart className="h-[22px] w-[22px]" strokeWidth={1.8} />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-dune" />
          </button>
          <a
            href="#dm"
            aria-label="Nachricht schreiben"
            className="text-snow transition-transform active:scale-90"
          >
            <Send className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </a>
        </div>
      </div>
    </motion.header>
  );
}
