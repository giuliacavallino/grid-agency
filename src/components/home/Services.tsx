import Image from "next/image";
import { ChevronDown, Plus, Sparkles } from "lucide-react";
import { extraServices, services } from "@/lib/content";
import { Section, SectionHead } from "./Section";

// Bento: Content Creation ist das Herzstück und bekommt die hohe Kachel;
// die letzte Reihe teilen sich Google und die beiden Add-ons.
const layout = [
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2 lg:row-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
];

/** Leistungen als Bento-Grid aus Glaskarten. Die Details klappen per
 * <details> auf, ganz ohne JavaScript. */
export function Services() {
  return (
    <Section id="leistungen">
      <SectionHead
        eyebrow="Leistungen"
        title={
          <>
            Alles, was dein Feed <span className="text-aurora">braucht</span>.
          </>
        }
        text="Vom Setup bis zur Kampagne: ein Team, ein Ansprechpartner, ein Feed, der liefert. Produktion ist inklusive, keine Zusatzposition."
      />

      <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-6">
        {services.map((service, i) => {
          const big = i === 2;
          return (
            <article
              key={service.number}
              className={`group reveal card-rainbow glass flex flex-col overflow-hidden rounded-[1.75rem] ${layout[i]}`}
              style={{ "--d": `${(i % 3) * 80}ms` } as React.CSSProperties}
            >
              {service.image && (
                <div className={`relative w-full overflow-hidden ${big ? "aspect-[4/3] lg:aspect-auto lg:flex-1" : "aspect-[16/9]"}`}>
                  <Image
                    src={service.image}
                    alt=""
                    fill
                    sizes={big ? "(min-width: 800px) 50vw, 100vw" : "(min-width: 800px) 33vw, 100vw"}
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sky/90 via-sky/10 to-transparent" />
                  <span className="glass absolute left-4 top-4 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums text-snow">
                    {service.number}
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-6 lg:p-7">
                <h3 className="card-rainbow-title text-2xl font-semibold tracking-tight text-snow">
                  {service.title} {service.accent && <span className="font-light text-snow/60">{service.accent}</span>}
                </h3>
                <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">{service.tagline}</p>
                {service.highlight && (
                  <p className="mt-4 flex gap-2 rounded-2xl bg-snow/[0.06] px-4 py-3 text-sm font-medium leading-relaxed text-snow">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sun" strokeWidth={2} />
                    {service.highlight}
                  </p>
                )}
                <details className="group/d mt-auto pt-5">
                  <summary className="flex items-center gap-1.5 text-sm font-medium text-snow/80 hover:text-snow">
                    Was genau drin ist
                    <ChevronDown className="details-chevron h-4 w-4 transition-transform" strokeWidth={2} />
                  </summary>
                  <ul className="details-body mt-4 space-y-2.5">
                    {service.bullets.map((b) => (
                      <li key={b} className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/70">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-snow/50" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </article>
          );
        })}
        {extraServices.map((extra, i) => (
          <article key={extra.title} className="reveal rounded-[1.75rem] border border-dashed border-snow/15 p-6 lg:col-span-2 lg:p-7" style={{ "--d": `${(i + 1) * 80}ms` } as React.CSSProperties}>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-snow/50">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              Add-on
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-snow">{extra.title}</h3>
            <p className="mt-1 text-sm font-light text-dune">{extra.reference}</p>
            <ul className="mt-4 space-y-2">
              {extra.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/70">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-snow/50" />
                  {b}
                </li>
              ))}
            </ul>
            {extra.highlight && <p className="mt-4 text-sm font-medium text-snow">{extra.highlight}</p>}
          </article>
        ))}
      </div>
    </Section>
  );
}
