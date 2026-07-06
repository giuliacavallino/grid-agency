"use client";

import Image from "next/image";
import { Heart, Send } from "lucide-react";
import { motion } from "framer-motion";

export function TopBar() {
  return (
    <motion.header
      initial={{ y: -56, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 z-40 flex h-14 w-full max-w-[560px] items-center justify-between border-b border-snow/10 bg-sky/85 px-4 backdrop-blur-lg"
    >
      <a href="#profil" aria-label="Nach oben">
        <Image
          src="/brand/grid_logo_snow.png"
          alt="GRID"
          width={82}
          height={22}
          priority
        />
      </a>
      <div className="flex items-center gap-5">
        <button
          aria-label="Aktivität"
          className="relative text-snow transition-transform active:scale-90"
        >
          <Heart className="h-6 w-6" strokeWidth={1.8} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-dune" />
        </button>
        <a
          href="#dm"
          aria-label="Nachricht schreiben"
          className="text-snow transition-transform active:scale-90"
        >
          <Send className="h-6 w-6" strokeWidth={1.8} />
        </a>
      </div>
    </motion.header>
  );
}
