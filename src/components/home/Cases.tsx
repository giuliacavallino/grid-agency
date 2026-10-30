import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Quote, Star } from "lucide-react";
import { caseStudyTeasers, clientSlug, testimonials } from "@/lib/content";
import { Section, SectionHead } from "./Section";

/** Drei Case Studies als große Karten mit Mockup und Kennzahl, darunter
 * die Kundenstimme. */
export function Cases() {
  const quote = testimonials[0];
  return (
    <Section id="cases">
      <SectionHead
        eyebrow="Case Studies"
        title={
          <>
            Zahlen, die man <span className="text-aurora">fühlt</span>.
          </>
        }
        text="Drei Marken, drei Ausgangslagen, ein Ergebnis: ein Feed, über den gesprochen wird."
        action={
          <Link href="/projekte" className="btn btn-glass px-5 py-3 text-sm">
            Alle Projekte
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      />

      <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-3">
        {caseStudyTeasers.map((cs, i) => (
          <Link
            key={cs.client}
            href={`/projekte/${clientSlug(cs.client)}`}
            className="group reveal card-rainbow glass flex flex-col overflow-hidden rounded-[1.75rem]"
            style={{ "--d": `${i * 90}ms` } as React.CSSProperties}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-grape/25 via-transparent to-flame/20">
              <Image
                src={cs.image}
                alt={`${cs.client}, Social-Media-Auftritt`}
                fill
                sizes="(min-width: 800px) 33vw, 100vw"
                className="object-contain p-6 transition-transform duration-700 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col p-6 lg:p-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="card-rainbow-title text-2xl font-semibold tracking-tight text-snow">{cs.client}</h3>
                <ArrowUpRight className="h-5 w-5 text-snow/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-snow" strokeWidth={2} />
              </div>
              <p className="mt-3 inline-flex self-start rounded-full bg-snow px-3 py-1 text-xs font-semibold text-sky">{cs.stat}</p>
              <p className="mt-4 text-sm font-light leading-relaxed text-snow/65">{cs.teaser}</p>
            </div>
          </Link>
        ))}
      </div>

      {quote && (
        <figure className="reveal glass mt-4 flex flex-col gap-6 rounded-[1.75rem] p-7 lg:flex-row lg:items-center lg:p-10">
          <Quote className="h-10 w-10 shrink-0 text-pop" strokeWidth={1.5} />
          <blockquote className="flex-1 text-xl font-light leading-snug tracking-tight text-snow lg:text-2xl">„{quote.quote}“</blockquote>
          <figcaption className="shrink-0 lg:max-w-[16rem]">
            <span className="flex text-sun">
              {Array.from({ length: quote.rating ?? 5 }, (_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" strokeWidth={0} />
              ))}
            </span>
            <span className="mt-2 block text-sm font-medium text-snow">{quote.name}</span>
            {quote.meta && <span className="mt-0.5 block text-xs font-light text-snow/50">{quote.meta}</span>}
          </figcaption>
        </figure>
      )}
    </Section>
  );
}
