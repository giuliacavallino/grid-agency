"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ChevronDown, Clock, MapPin } from "lucide-react";
import { jobsIntro, type Job } from "@/lib/content";
import { ApplicationForm } from "@/components/ApplicationForm";
import { SearchedChip } from "@/components/SearchedChip";

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/70"
        >
          <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-dune" />
          {item}
        </li>
      ))}
    </ul>
  );
}

type BtsItem =
  | { kind: "video"; src: string; poster: string; alt: string }
  | { kind: "image"; src: string; alt: string };

/** Behind the Scenes: kurze stumme Loops und Fotos von echten Drehs
 * (Frittenwerk-Shoot, Casa Beef, Burger-Drehs, Interview-Setup). */
const bts: BtsItem[] = [
  { kind: "video", src: "/jobs/bts-burger.mp4", poster: "/jobs/bts-burger.jpg", alt: "Behind the Scenes beim Burger-Dreh" },
  { kind: "image", src: "/jobs/bts-rolltreppe.webp", alt: "Frittenwerk-Shoot auf der Rolltreppe" },
  { kind: "video", src: "/jobs/bts-monitor.mp4", poster: "/jobs/bts-monitor.jpg", alt: "Behind the Scenes: Blick auf den Kameramonitor im Showroom" },
  { kind: "video", src: "/jobs/bts-studio.mp4", poster: "/jobs/bts-studio.jpg", alt: "Behind the Scenes beim Fotoshooting im Studio" },
  { kind: "video", src: "/jobs/bts-picknick.mp4", poster: "/jobs/bts-picknick.jpg", alt: "Behind the Scenes: Aufbau fürs Picknick-Shooting" },
  { kind: "image", src: "/referenzen/casa-beef/bts-1.webp", alt: "Behind the Scenes beim Content-Day im Casa Beef" },
  { kind: "video", src: "/jobs/bts-lichter.mp4", poster: "/jobs/bts-lichter.jpg", alt: "Behind the Scenes: Crew und Model zwischen den Lichtern" },
  { kind: "video", src: "/jobs/bts-mikro.mp4", poster: "/jobs/bts-mikro.jpg", alt: "Behind the Scenes: Mikro anstecken vor dem Dreh" },
  { kind: "video", src: "/jobs/bts-michelle.mp4", poster: "/jobs/bts-michelle.jpg", alt: "Behind the Scenes: Content-Shooting am Pass" },
  { kind: "video", src: "/jobs/bts-tasche.mp4", poster: "/jobs/bts-tasche.jpg", alt: "Behind the Scenes: Set fürs Taschen-Shooting" },
  { kind: "video", src: "/jobs/bts-laptop.mp4", poster: "/jobs/bts-laptop.jpg", alt: "Behind the Scenes: Bildauswahl am Laptop" },
  { kind: "video", src: "/jobs/bts-sbahn.mp4", poster: "/jobs/bts-sbahn.jpg", alt: "Behind the Scenes beim S-Bahn-Shooting" },
  { kind: "video", src: "/jobs/bts-kamera.mp4", poster: "/jobs/bts-kamera.jpg", alt: "Behind the Scenes: Fotograf beim Portrait-Shooting" },
  { kind: "video", src: "/jobs/bts-interview.mp4", poster: "/jobs/bts-interview.jpg", alt: "Behind the Scenes beim Interview-Dreh" },
  { kind: "video", src: "/jobs/bts-fotograf.mp4", poster: "/jobs/bts-fotograf.jpg", alt: "Behind the Scenes: Blick über die Schulter des Fotografen" },
  { kind: "video", src: "/jobs/bts-armband.mp4", poster: "/jobs/bts-armband.jpg", alt: "Behind the Scenes: Armband auf dem Kameradisplay" },
  { kind: "video", src: "/jobs/bts-laden.mp4", poster: "/jobs/bts-laden.jpg", alt: "Behind the Scenes: Filmen im Laden" },
  { kind: "video", src: "/jobs/bts-cafe.mp4", poster: "/jobs/bts-cafe.jpg", alt: "Arbeiten im Café: Planung und Schnitt" },
];

/** Stellen: jede als aufklappbare Karte mit Rolle, Aufgaben, Profil und
 * Benefits, darunter das Bewerbungsformular. Alle Stellen sind immer
 * wählbar; welche wir gerade suchen (grüner Chip), steuert das Intranet
 * (Personal → Stellen). */
export function JobsView({ jobs, searched }: { jobs: Job[]; searched: string[] }) {
  const [open, setOpen] = useState<string | null>(jobs[0]?.slug ?? null);
  const [applyFor, setApplyFor] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const apply = (slug: string) => {
    setApplyFor(slug);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Jobs
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Werde Teil von <span className="text-scroll-gradient">GRID</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-snow/65">
          {jobsIntro}
        </p>
        <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-snow/65">
          Kleines Team, flache Hierarchien, ein lockeres Arbeitsumfeld mit
          viel Freiheit und Selbstständigkeit. Bewerben kannst du dich auf
          jede Rolle in Berlin und Frankfurt, auch initiativ. Was wir gerade
          suchen, ist markiert.
        </p>
      </motion.div>

      {/* Behind the Scenes: kurze Loops und Fotos von echten Drehs, damit
          man sieht, wie die Arbeit bei GRID aussieht. Videos laden erst,
          wenn sie im Viewport sind. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mt-8"
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Behind the Scenes
        </p>
        {/* Laufender Streifen auf voller Breite, wie das Logo-Band. Feste
            Kachelgrößen, damit lazy geladene Medien den Loop nicht
            verschieben. */}
        <div className="relative left-1/2 mt-3 w-screen -translate-x-1/2 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-sky to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-sky to-transparent" />
          <div
            className="marquee flex w-max items-stretch [&:hover]:[animation-play-state:paused]"
            style={{ "--marquee-duration": `${bts.length * 5}s` } as React.CSSProperties}
          >
          {[...bts, ...bts].map((item, i) => (
            <div
              key={`${item.src}-${i}`}
              className="mr-3 aspect-[4/5] h-56 shrink-0 overflow-hidden rounded-2xl border border-snow/10 bg-sky lg:h-72"
            >
              {item.kind === "video" ? (
                <video
                  src={item.src}
                  poster={item.poster}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={item.alt}
                  className="h-full w-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.src}
                  alt={item.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          ))}
          </div>
        </div>
      </motion.div>

      <div className="mt-8 space-y-4">
        {jobs.map((job, i) => {
          const isOpen = open === job.slug;
          return (
            <motion.div
              key={job.slug}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="card-rainbow overflow-hidden rounded-2xl border border-snow/10"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : job.slug)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-4 p-5 text-left sm:p-6"
              >
                <div>
                  {searched.includes(job.slug) && (
                    <div className="mb-2">
                      <SearchedChip />
                    </div>
                  )}
                  <h2 className="card-rainbow-title text-xl font-medium tracking-tight text-snow">
                    {job.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-light text-snow/60">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                      {job.scope}
                      {job.duration ? `, ${job.duration}` : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                      {job.location}
                    </span>
                  </div>
                  {!isOpen && (
                    <p className="mt-3 text-sm font-light leading-relaxed text-snow/65">
                      {job.role}
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={`mt-1 h-5 w-5 shrink-0 text-snow/50 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-snow/10 px-5 pb-6 pt-5 sm:px-6">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
                        Deine Rolle
                      </p>
                      <p className="mt-2 text-sm font-light leading-relaxed text-snow/75">
                        {job.role}
                      </p>

                      <div className="mt-6 grid gap-6 lg:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
                            Deine Aufgaben
                          </p>
                          <Bullets items={job.tasks} />
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
                            Dein Profil
                          </p>
                          <Bullets items={job.profile} />
                        </div>
                      </div>

                      <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-dune">
                        Was wir bieten
                      </p>
                      <Bullets items={job.benefits} />

                      <div className="mt-6 rounded-xl bg-snow/[0.05] p-5">
                        <p className="text-sm font-medium leading-relaxed text-snow">
                          {job.pitch}
                        </p>
                        <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
                          Dann bewirb dich jetzt mit deinem Lebenslauf. Wir
                          freuen uns darauf, mehr über dich zu erfahren.
                        </p>
                        <button
                          type="button"
                          onClick={() => apply(job.slug)}
                          className="btn-rainbow mt-4 inline-flex items-center gap-2 rounded-full bg-snow px-6 py-3 text-sm font-medium text-sky"
                        >
                          Jetzt bewerben
                          <ArrowDown className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div ref={formRef} id="bewerben" className="mt-12 scroll-mt-24">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Bewerben
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-snow">
          Deine Bewerbung
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-light leading-relaxed text-snow/65">
          Lebenslauf hochladen, ein paar Zeilen zu dir, fertig. Nichts
          Passendes dabei? Wähl einfach „Initiativbewerbung“.
        </p>
        <div className="mt-6">
          <ApplicationForm
            jobs={jobs}
            searched={searched}
            job={applyFor}
            onJobChange={setApplyFor}
          />
        </div>
      </div>
    </div>
  );
}
