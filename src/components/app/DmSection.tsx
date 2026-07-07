"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ContactForm } from "@/components/ContactForm";

export function DmSection() {
  return (
    <div className="px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Direct Message
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow">
          Slide in unsere <span className="text-scroll-gradient">DMs</span>.
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-6 rounded-2xl border border-snow/10 bg-earth/10 p-5"
      >
        <div className="mb-5 flex items-center gap-2.5 border-b border-snow/10 pb-4">
          <span className="story-ring flex h-9 w-9 items-center justify-center rounded-full p-[2px]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-sky">
              <Image
                src="/brand/grid_monogram_snow.png"
                alt=""
                width={20}
                height={11}
              />
            </span>
          </span>
          <div>
            <p className="text-sm font-medium text-snow">grid.berlin</p>
            <p className="text-[11px] font-light text-dune">
              antwortet innerhalb von 2 Werktagen
            </p>
          </div>
        </div>
        <ContactForm />
      </motion.div>

      <div className="mt-10 space-y-1 text-center text-[11px] font-light text-snow/35">
        <p>Berlin · Linienstrasse 214 — Frankfurt · Eichendorffstrasse 32</p>
        <p>hello@grid-agency.de · +49 1512 2910161</p>
        <p className="flex items-center justify-center gap-3 pt-1">
          <a href="/impressum" className="hover:text-snow/60">
            Impressum
          </a>
          <a href="/datenschutz" className="hover:text-snow/60">
            Datenschutz
          </a>
        </p>
      </div>
    </div>
  );
}
