"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Clock, MapPin } from "lucide-react";
import { jobs, jobsEmail, jobsIntro, type Job } from "@/lib/content";

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

const bts: (
  | { kind: "video"; src: string; poster: string; alt: string }
  | { kind: "image"; src: string; alt: string }
)[] = [
  { kind: "video", src: "/jobs/bts-burger.mp4", poster: "/jobs/bts-burger.jpg", alt: "Behind the Scenes beim Burger-Dreh" },
  { kind: "image", src: "/referenzen/casa-beef/bts-1.webp", alt: "Behind the Scenes beim Content-Day im Casa Beef" },
  { kind: "video", src: "/jobs/bts-michelle.mp4", poster: "/jobs/bts-michelle.jpg", alt: "Behind the Scenes: Content-Shooting am Pass" },
  { kind: "video", src: "/jobs/bts-interview.mp4", poster: "/jobs/bts-interview.jpg", alt: "Behind the Scenes beim Interview-Dreh" },
];

function applyHref(job: Job): string {
  const subject = encodeURIComponent(`Bewerbung: ${job.title}`);
  const body = encodeURIComponent(
    `Hallo Giulia,\n\nich bewerbe mich auf die Stelle „${job.title}“ bei GRID Agency.\n\nLebenslauf und Anschreiben findest du im Anhang.\n\nViele Grüße\n`,
  );
  return `mailto:${jobsEmail}?subject=${subject}&body=${body}`;
}

/** Offene Stellen: jede Stelle als aufklappbare Karte mit Rolle,
 * Aufgaben, Profil, Benefits und Bewerben-Button (Mail mit
 * vorausgefülltem Betreff). */
export function JobsView() {
  const [open, setOpen] = useState<string | null>(jobs[0]?.slug ?? null);

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
          viel Freiheit und Selbstständigkeit. Das sind unsere offenen
          Stellen in Berlin-Mitte:
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
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {bts.map((item) => (
            <div
              key={item.src}
              className="aspect-[4/5] overflow-hidden rounded-2xl border border-snow/10 bg-sky"
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
                          Dann bewirb dich jetzt. Schick uns deinen Lebenslauf
                          und ein Anschreiben, wir freuen uns darauf, mehr über
                          dich zu erfahren.
                        </p>
                        <a
                          href={applyHref(job)}
                          className="btn-rainbow mt-4 inline-flex items-center gap-2 rounded-full bg-snow px-6 py-3 text-sm font-medium text-sky active:scale-[0.97]"
                        >
                          Jetzt bewerben
                          <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm font-light text-snow/50">
        Nichts Passendes dabei?{" "}
        <a
          href={`mailto:${jobsEmail}?subject=${encodeURIComponent("Initiativbewerbung bei GRID Agency")}`}
          className="font-medium text-dune underline-offset-4 hover:underline"
        >
          Initiativbewerbung schicken →
        </a>
      </p>
    </div>
  );
}
