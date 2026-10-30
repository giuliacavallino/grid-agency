import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { team, vita } from "@/lib/content";
import { Section, SectionHead } from "./Section";

/** Über uns: Giulia als Profilkarte, daneben die Agentur-Vita. */
export function Team() {
  return (
    <Section id="team">
      <SectionHead
        eyebrow="Über uns"
        title={
          <>
            Klein genug für <span className="text-aurora">Tempo</span>. Groß genug für Wirkung.
          </>
        }
      />

      <div className="mt-12 grid grid-cols-1 gap-4 lg:mt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <article className="reveal glass overflow-hidden rounded-[1.75rem]">
          <div className="relative aspect-[4/3] lg:aspect-[5/4]">
            <Image src="/team/giulia.jpg" alt={team.name} fill sizes="(min-width: 800px) 40vw, 100vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-sky via-sky/20 to-transparent" />
            <div className="absolute bottom-5 left-6 right-6">
              <p className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight text-snow">
                {team.name}
                <BadgeCheck className="h-5 w-5 fill-[#3897f0] text-sky" strokeWidth={2} />
              </p>
              <p className="text-sm font-light text-snow/70">{team.role}</p>
            </div>
          </div>
          <div className="p-6 lg:p-7">
            <p className="text-sm font-light leading-relaxed text-snow/75">{team.bio}</p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {team.facts.map((fact) => (
                <div key={fact.label} className="rounded-2xl bg-snow/[0.05] px-3 py-3 text-center">
                  <p className="text-xl font-semibold text-snow">{fact.value}</p>
                  <p className="mt-0.5 text-[0.6875rem] font-light text-snow/55">{fact.label}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <div className="reveal glass flex flex-col rounded-[1.75rem] p-6 lg:p-10" style={{ "--d": "100ms" } as React.CSSProperties}>
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-snow/45">Die Story</p>
          <ol className="mt-6 flex-1 space-y-7">
            {vita.map((station) => (
              <li key={station.year} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4">
                <span className="text-aurora text-2xl font-semibold tracking-tight tabular-nums">{station.year}</span>
                <p className="text-sm font-light leading-relaxed text-snow/70 lg:text-base">{station.text}</p>
              </li>
            ))}
          </ol>
          <Link href="/jobs" className="group mt-8 flex items-center justify-between gap-4 rounded-2xl bg-snow/[0.06] p-5 transition-colors hover:bg-snow/10">
            <span>
              <span className="block text-base font-semibold text-snow">Du willst ins Grid?</span>
              <span className="block text-sm font-light text-snow/60">Offene Stellen in Berlin und Frankfurt</span>
            </span>
            <ArrowRight className="h-5 w-5 text-snow transition-transform group-hover:translate-x-1" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </Section>
  );
}
