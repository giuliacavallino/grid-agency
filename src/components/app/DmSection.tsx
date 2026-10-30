"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { BookingLink } from "./BookingProvider";
import { SiteFooter } from "./SiteFooter";

/** Kontakt: Desktop links Überschrift und Kontaktdaten, rechts Formular
 * und Terminbuchung, alles auf einem Bildschirm. Mobil füllt Überschrift plus
 * Formular einen Bildschirm, Terminbuchung und Adressen laufen darunter aus.
 * Die beiden Wrapper sind ab Desktop `contents`, ihre Kinder sitzen dann
 * direkt im Zwei-Spalten-Grid. */
export function DmSection() {
  return (
    <div className="px-5 lg:screen lg:px-gutter">
      <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-x-[clamp(3rem,6vw,8rem)]">
        <div className="max-lg:screen lg:contents">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="lg:self-center"
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
              Kontakt
            </p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow lg:text-6xl">
              Lass uns <span className="text-scroll-gradient">reden</span>.
            </h2>
            <p className="mt-4 hidden max-w-md text-base font-light leading-relaxed text-snow/70 lg:block">
              Schreib uns, was dein Feed gerade braucht. Wir melden uns innerhalb
              von zwei Werktagen mit einer ehrlichen Einschätzung.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-5 rounded-2xl border border-snow/10 bg-earth/10 p-5 lg:col-start-2 lg:mt-0"
          >
            {/* Absender-Kopf wie in einem DM-Thread; mobil gespart, damit
                das Formular auf einen Bildschirm passt. */}
            <div className="mb-5 hidden items-center gap-2.5 border-b border-snow/10 pb-4 lg:flex">
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
                <p className="text-[0.6875rem] font-light text-dune">
                  antwortet innerhalb von 2 Werktagen
                </p>
              </div>
            </div>
            <ContactForm />
          </motion.div>
        </div>

        <div className="pb-[var(--screen-pb)] lg:contents">
          {/* Eigene Terminbuchung im kleinen Fenster (freie Zeiten aus
              unserem Kalender, kein Drittanbieter). */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-start-2 lg:mt-5"
          >
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-snow/10" />
              <span className="text-[0.6875rem] font-light uppercase tracking-[0.25em] text-snow/40">
                oder direkt
              </span>
              <span className="h-px flex-1 bg-snow/10" />
            </div>
            <BookingLink
              className="btn-rainbow mt-4 flex items-center justify-center gap-2 rounded-full bg-snow py-3 text-sm font-medium text-sky active:scale-[0.97] lg:mx-auto lg:max-w-sm"
            >
              <CalendarClock className="h-4 w-4" strokeWidth={2} />
              Termin buchen: Boost your Socials
            </BookingLink>
          </motion.div>

          {/* Desktop unten in der linken Spalte, mobil zentriert am Ende. */}
          <SiteFooter className="mt-8 lg:col-start-1 lg:row-start-2 lg:mt-0 lg:self-end lg:text-left" />
        </div>
      </div>
    </div>
  );
}
