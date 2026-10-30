import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Quote, Sparkles } from "lucide-react";
import { PageShell } from "@/components/app/PageShell";
import { ClientMediaTabs, type MediaTab } from "@/components/app/ClientMediaTabs";
import { InstagramIcon } from "@/components/app/InstagramIcon";
import { ContactLink } from "@/components/ui/ContactLink";
import { clients, clientSlug } from "@/lib/content";
import { nextEvent } from "@/lib/events";
import { imageSize, logoWidth } from "@/lib/media";

export const revalidate = 60;

export function generateStaticParams() {
  return clients.map((c) => ({ slug: clientSlug(c.name) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const client = clients.find((c) => clientSlug(c.name) === slug);
  return {
    title: client ? `${client.name} · Projekt | GRID Agency` : "Projekt | GRID Agency",
    description: client?.intro,
  };
}

const withSize = (images: string[]) =>
  images.map((src) => {
    const [width, height] = imageSize(src);
    return { src, width, height };
  });

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const client = clients.find((c) => clientSlug(c.name) === slug);
  if (!client) notFound();

  const event = await nextEvent(client.name);
  const tabs: MediaTab[] = [];
  if (client.gallery?.length) tabs.push({ title: "Galerie", images: withSize(client.gallery) });
  for (const s of client.sections ?? []) {
    if (s.images?.length || s.video) tabs.push({ title: s.title, text: s.text, images: withSize(s.images ?? []), video: s.video });
  }
  const logo = client.logoDetail ?? client.logo;
  const logoHeight = Math.round(Math.min((client.height ?? 32) * 1.8, 80));
  const tags = client.tags ?? ["Social Media Management", "Content Creation"];

  return (
    <PageShell>
      <Link href="/projekte" className="rise inline-flex items-center gap-1.5 text-sm font-light text-snow/60 hover:text-snow">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Alle Projekte
      </Link>

      <header className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="rise glass flex min-h-56 items-center justify-center rounded-[2rem] p-8">
          <h1>
            {logo ? (
              <Image
                src={logo}
                alt={client.name}
                height={logoHeight}
                width={logoWidth(logo, logoHeight)}
                priority
                style={{ height: `${logoHeight / 16}rem`, width: "auto" }}
                className="max-w-full object-contain"
              />
            ) : (
              <span className="text-3xl font-semibold uppercase tracking-[0.15em] text-snow">{client.name}</span>
            )}
          </h1>
        </div>
        <div className="rise flex flex-col justify-center rounded-[2rem] p-2 lg:p-6" style={{ "--d": "80ms" } as React.CSSProperties}>
          <span className="eyebrow self-start">Projekt</span>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-snow/[0.08] px-3 py-1 text-xs font-light text-snow/80">
                {tag}
              </span>
            ))}
          </div>
          {client.intro && <p className="mt-5 max-w-2xl text-xl font-light leading-snug tracking-tight text-snow lg:text-2xl">{client.intro}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            {client.instagram && (
              <a href={`https://www.instagram.com/${client.instagram}/`} target="_blank" rel="noopener noreferrer" className="btn btn-primary px-5 py-3 text-sm">
                <InstagramIcon className="h-4 w-4" />@{client.instagram}
              </a>
            )}
            {tabs.length > 0 && (
              <a href="#galerie" className="btn btn-glass px-5 py-3 text-sm">
                Zur Galerie
              </a>
            )}
          </div>
        </div>
      </header>

      {event && (
        <Link href="/events" className="reveal glass mt-4 flex items-center gap-4 rounded-[1.5rem] p-4 transition-colors hover:bg-snow/10">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-snow text-sky">
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium uppercase tracking-[0.2em] text-snow/50">Event nicht verpassen</span>
            <span className="block truncate text-base font-semibold text-snow">{event.title}</span>
          </span>
          <ArrowRight className="h-5 w-5 text-snow" strokeWidth={2} />
        </Link>
      )}

      {client.results && client.results.length > 0 && (
        <section className="mt-16 lg:mt-24">
          <span className="eyebrow">Ergebnisse</span>
          <div className={`mt-6 grid gap-4 ${client.results.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
            {client.results.map((r, i) => (
              <div key={r.label} className="reveal glass rounded-[1.75rem] p-6 lg:p-8" style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
                <p className="text-aurora text-5xl font-semibold tracking-[-0.04em]">{r.value}</p>
                <p className="mt-2 text-base font-medium text-snow">{r.label}</p>
                <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">{r.text}</p>
              </div>
            ))}
          </div>
          {client.resultsSource && <p className="mt-3 text-[0.6875rem] font-light text-snow/40">{client.resultsSource}</p>}
        </section>
      )}

      {(client.caseStudy || client.testimonial) && (
        <section className={`mt-16 grid grid-cols-1 gap-4 lg:mt-24 ${client.caseStudy && client.testimonial ? "lg:grid-cols-2" : ""}`}>
          {client.caseStudy && (
            <div className="reveal glass rounded-[1.75rem] p-6 lg:p-8">
              <span className="eyebrow">Der Case</span>
              <p className="mt-5 text-base font-light leading-relaxed text-snow/80">{client.caseStudy}</p>
            </div>
          )}
          {client.testimonial && (
            <figure className="reveal glass rounded-[1.75rem] p-6 lg:p-8" style={{ "--d": "80ms" } as React.CSSProperties}>
              <Quote className="h-8 w-8 text-pop" strokeWidth={1.5} />
              <blockquote className="mt-4 text-lg font-light leading-snug text-snow">&bdquo;{client.testimonial.quote}&ldquo;</blockquote>
              <figcaption className="mt-5">
                <p className="text-sm font-medium text-snow">{client.testimonial.name}</p>
                {client.testimonial.meta && <p className="text-xs font-light text-snow/50">{client.testimonial.meta}</p>}
              </figcaption>
            </figure>
          )}
        </section>
      )}

      <ClientMediaTabs name={client.name} tabs={tabs} />

      {client.sections
        ?.filter((s) => !s.images?.length && !s.video)
        .map((section) => (
          <section key={section.title} className="mt-16">
            <span className="eyebrow">{section.title}</span>
            {section.text && <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-snow/70">{section.text}</p>}
            <p className="mt-4 rounded-[1.5rem] border border-dashed border-snow/15 px-4 py-6 text-center text-xs font-light text-snow/40">Material folgt in Kürze.</p>
          </section>
        ))}

      {tabs.length === 0 && (
        <section id="galerie" className="mt-16 scroll-mt-28">
          <span className="eyebrow">Galerie</span>
          <p className="mt-4 rounded-[1.5rem] border border-dashed border-snow/15 px-4 py-6 text-center text-xs font-light text-snow/40">Einblicke folgen in Kürze.</p>
        </section>
      )}

      <div className="reveal mt-20 text-center">
        <p className="text-2xl font-semibold tracking-tight text-snow">Das willst du auch?</p>
        <ContactLink tab="termin" className="btn btn-primary mt-5 px-6 py-3.5 text-sm">
          Erstgespräch buchen
        </ContactLink>
      </div>
    </PageShell>
  );
}
