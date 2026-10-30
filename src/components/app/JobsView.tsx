"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ChevronDown, Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
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
          <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-pop" />
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
/** Stummer Loop, der erst lädt und spielt, wenn er ins Bild läuft. */
function LazyLoop({ src, poster, alt }: { src: string; poster: string; alt: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          void video.play().catch(() => {});
        } else video.pause();
      },
      { rootMargin: "0px 200px" },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={near ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      aria-label={alt}
      className="h-full w-full object-cover"
    />
  );
}

export function JobsView({ jobs, searched }: { jobs: Job[]; searched: string[] }) {
  const [applyFor, setApplyFor] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const apply = (slug: string) => {
    setApplyFor(slug);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Jobs"
        title={
          <>
            Werde Teil von <span className="text-aurora">GRID</span>.
          </>
        }
        text={jobsIntro}
      >
        <p className="mt-3 max-w-2xl text-base font-light leading-relaxed text-snow/65">
          Kleines Team, flache Hierarchien, viel Freiheit und Selbstständigkeit. Bewerben kannst du dich auf jede Rolle in
          Berlin und Frankfurt, auch initiativ. Was wir gerade suchen, ist markiert.
        </p>
      </PageHeader>

      {/* Behind the Scenes als Laufband; Videos laden erst im Bild. */}
      <section className="rise mt-12" style={{ "--d": "150ms" } as React.CSSProperties}>
        <span className="eyebrow">Behind the Scenes</span>
        <div className="fade-x relative left-1/2 mt-5 w-screen -translate-x-1/2 overflow-hidden">
          <div className="marquee flex w-max items-stretch" style={{ "--marquee-duration": `${bts.length * 5}s` } as React.CSSProperties}>
            {[...bts, ...bts].map((item, i) => (
              <div key={`${item.src}-${i}`} className="relative mr-3 aspect-[4/5] h-60 shrink-0 overflow-hidden rounded-[1.5rem] border border-snow/10 bg-sky lg:h-80">
                {item.kind === "video" ? (
                  <LazyLoop src={item.src} poster={item.poster} alt={item.alt} />
                ) : (
                  <Image src={item.src} alt={item.alt} fill sizes="256px" className="object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-12 space-y-3">
        {jobs.map((job, i) => (
          <details
            key={job.slug}
            open={i === 0}
            className="reveal card-rainbow glass group overflow-hidden rounded-[1.75rem]"
            style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
          >
            <summary className="flex items-start justify-between gap-4 p-6 sm:p-7">
              <div>
                {searched.includes(job.slug) && (
                  <div className="mb-2">
                    <SearchedChip />
                  </div>
                )}
                <h2 className="card-rainbow-title text-2xl font-semibold tracking-tight text-snow">{job.title}</h2>
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
                <p className="mt-3 text-sm font-light leading-relaxed text-snow/65 group-open:hidden">{job.role}</p>
              </div>
              <span className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                <ChevronDown className="details-chevron h-4 w-4 text-snow transition-transform duration-300" strokeWidth={2} />
              </span>
            </summary>

            <div className="details-body border-t border-snow/10 px-6 pb-7 pt-6 sm:px-7">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-snow/50">Deine Rolle</p>
              <p className="mt-2 text-sm font-light leading-relaxed text-snow/75">{job.role}</p>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-snow/50">Deine Aufgaben</p>
                  <Bullets items={job.tasks} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-snow/50">Dein Profil</p>
                  <Bullets items={job.profile} />
                </div>
              </div>
              <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-snow/50">Was wir bieten</p>
              <Bullets items={job.benefits} />
              <div className="mt-6 rounded-2xl bg-snow/[0.06] p-5">
                <p className="text-sm font-medium leading-relaxed text-snow">{job.pitch}</p>
                <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
                  Dann bewirb dich jetzt mit deinem Lebenslauf. Wir freuen uns darauf, mehr über dich zu erfahren.
                </p>
                <button type="button" onClick={() => apply(job.slug)} className="btn btn-primary mt-4 px-6 py-3 text-sm">
                  Jetzt bewerben
                  <ArrowDown className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </details>
        ))}
      </div>

      <div ref={formRef} id="bewerben" className="reveal glass mt-16 scroll-mt-28 rounded-[2rem] p-6 sm:p-8 lg:p-10">
        <span className="eyebrow">Bewerben</span>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-snow lg:text-5xl">Deine Bewerbung</h2>
        <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-snow/65">
          Lebenslauf hochladen, ein paar Zeilen zu dir, fertig. Nichts Passendes dabei? Wähl einfach „Initiativbewerbung“.
        </p>
        <div className="mt-6">
          <ApplicationForm jobs={jobs} searched={searched} job={applyFor} onJobChange={setApplyFor} />
        </div>
      </div>
    </div>
  );
}
