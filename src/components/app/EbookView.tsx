"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { EbookForm } from "@/components/EbookForm";

const chapters = [
  { n: "01", title: "Der Wandel", text: "Sechs Verschiebungen, die Social Media bis 2027 umkrempeln." },
  { n: "02", title: "Mehr Umsatz", text: "Der Weg vom Reel zur Buchung und was du an jeder Stufe tun musst." },
  { n: "03", title: "Zufriedenere Kund:innen", text: "Social Media als Service-Kanal, der Stammkund:innen macht." },
  { n: "04", title: "Mehr Bewerbungen", text: "Employer Branding plus ein Bewerbungsprozess ohne Hürden." },
  { n: "05", title: "90-Tage-Fahrplan", text: "Checkliste zum Abhaken und die Kennzahlen, die wirklich zählen." },
];

const facts = [
  { value: "18", label: "Seiten" },
  { value: "30+", label: "betreute Marken" },
  { value: "+875 %", label: "Ø mehr Reichweite" },
];

/** Landingpage für den E-Book-Leadmagneten „Social Media 2027“, Ziel der
 * Meta-Anzeigen. Mobil: Titel, Cover, Formular, Kapitel. Desktop: Titel
 * und Kapitel links, Cover und Formular rechts daneben. */
export function EbookView() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="lg:col-start-1 lg:row-start-1 lg:pt-4"
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Kostenloses E-Book für Unternehmer:innen
        </p>
        <h1 className="mt-3 text-4xl font-medium leading-[1.02] tracking-tight text-snow sm:text-5xl lg:text-6xl">
          Social Media <span className="text-scroll-gradient">2027</span>
        </h1>
        <p className="mt-5 max-w-xl text-base font-light leading-relaxed text-snow/70 lg:text-lg">
          Der Wandel – und was du jetzt tun musst, um auf Social Media mehr
          Umsatz, zufriedenere Kund:innen und mehr Bewerbungen zu gewinnen.
          Mit echten Zahlen aus unseren Projekten und einem 90-Tage-Fahrplan.
        </p>

        <dl className="mt-8 flex gap-8">
          {facts.map((f) => (
            <div key={f.label}>
              <dt className="sr-only">{f.label}</dt>
              <dd className="text-2xl font-medium tracking-tight text-snow">{f.value}</dd>
              <dd className="mt-0.5 text-xs font-light text-snow/50">{f.label}</dd>
            </div>
          ))}
        </dl>
      </motion.div>

      {/* Auf dem Desktop bleiben Cover und Formular beim Scrollen sichtbar. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1 }}
        className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="lg:sticky lg:top-32">
          <div className="relative mx-auto w-40 sm:w-56 lg:w-64">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-[linear-gradient(92deg,#feda75,#fa7e1e,#d62976,#962fbf)] opacity-25 blur-3xl"
            />
            <Image
              src="/ebook/cover.jpg"
              alt="Cover des E-Books Social Media 2027"
              width={794}
              height={1123}
              priority
              className="relative rotate-[-3deg] rounded-md shadow-2xl shadow-black/50"
            />
          </div>

          <div className="card-rainbow mt-10 rounded-2xl border border-snow/10 bg-sky p-6 sm:p-7">
            <EbookForm />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="lg:col-start-1 lg:row-start-2"
      >
        <h2 className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Das erwartet dich
        </h2>
        <ol className="mt-4 divide-y divide-snow/10 border-y border-snow/10">
          {chapters.map((c) => (
            <li key={c.n} className="flex gap-5 py-4">
              <span className="text-scroll-gradient text-lg font-medium">{c.n}</span>
              <div>
                <p className="text-base font-medium text-snow">{c.title}</p>
                <p className="mt-0.5 text-sm font-light leading-relaxed text-snow/60">{c.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </motion.div>
    </div>
  );
}
