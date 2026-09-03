"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { CalendlyLink } from "./CalendlyProvider";

export function DmSection() {
  return (
    <div className="px-5 py-10 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 lg:py-16">
      {/* Desktop: Überschrift und Kontaktdaten links, Formular rechts. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Kontakt
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow lg:text-5xl">
          Lass uns <span className="text-scroll-gradient">reden</span>.
        </h2>
        <p className="mt-4 hidden max-w-sm text-base font-light leading-relaxed text-snow/70 lg:block">
          Schreib uns, was dein Feed gerade braucht. Wir melden uns innerhalb
          von zwei Werktagen mit einer ehrlichen Einschätzung.
        </p>
      </motion.div>

      <div>
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

      {/* Calendly as a plain link in a new tab: booking without loading
          any third-party script on the page itself. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-6"
      >
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-snow/10" />
          <span className="text-[11px] font-light uppercase tracking-[0.25em] text-snow/40">
            oder direkt
          </span>
          <span className="h-px flex-1 bg-snow/10" />
        </div>
        <CalendlyLink
          className="btn-rainbow mt-4 flex items-center justify-center gap-2 rounded-full bg-snow py-3 text-sm font-medium text-sky active:scale-[0.97] lg:mx-auto lg:max-w-sm"
        >
          <CalendarClock className="h-4 w-4" strokeWidth={2} />
          Termin buchen: Boost your Socials
        </CalendlyLink>
      </motion.div>
      </div>

      <div className="mt-10 space-y-1 text-center text-[11px] font-light text-snow/35 lg:col-span-2">
        <p>Linienstrasse 214, Berlin · Eichendorffstrasse 32, Frankfurt</p>
        <p>
          <a href="mailto:hello@grid-agency.de" className="hover:text-snow/60">
            hello@grid-agency.de
          </a>
          {" · "}
          <a href="tel:+4915122910161" className="hover:text-snow/60">
            +49 1512 2910161
          </a>
        </p>
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
