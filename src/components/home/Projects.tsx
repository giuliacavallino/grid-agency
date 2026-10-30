import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { clients } from "@/lib/content";
import { ProjektCard } from "@/components/app/ProjektCard";
import { Section, SectionHead } from "./Section";

/** Vorzeigeprojekte (Kund:innen mit Rubriken), mobil als Wisch-Reihe. */
export function Projects() {
  const featured = clients.filter((c) => c.tags).slice(0, 6);
  return (
    <Section id="projekte">
      <SectionHead
        eyebrow="Projekte"
        title={
          <>
            Im Grid: Marken mit <span className="text-aurora">Appetit</span> auf mehr.
          </>
        }
        action={
          <Link href="/projekte" className="btn btn-glass px-5 py-3 text-sm">
            Alle {clients.length} Projekte
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      />
      <div className="snap-row mt-12 lg:mt-16 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:mx-0">
        {featured.map((client, i) => (
          <div key={client.name} className="reveal w-[84%] max-w-[22rem] sm:w-[46%] lg:w-auto lg:max-w-none" style={{ "--d": `${(i % 3) * 80}ms` } as React.CSSProperties}>
            <ProjektCard client={client} />
          </div>
        ))}
      </div>
    </Section>
  );
}
