import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Calendar, Camera, Clapperboard, MapPin, Ticket } from "lucide-react";
import type { GridEvent } from "@/lib/events";
import { ContactLink } from "@/components/ui/ContactLink";
import { PageHeader } from "@/components/ui/PageHeader";

// Eventzeiten sind Wanduhrzeiten in Deutschland, egal wo Besucher sind.
const TZ = "Europe/Berlin";
const dateFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: TZ });

function UpcomingCard({ event }: { event: GridEvent }) {
  const date = new Date(event.starts_at);
  return (
    <article className="rise glass grid grid-cols-1 overflow-hidden rounded-[2rem] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className={`relative w-full ${event.cover_url ? "aspect-[4/5]" : "aspect-[4/3]"} lg:aspect-auto lg:min-h-[28rem]`}>
        {event.cover_url ? (
          <Image src={event.cover_url} alt={event.title} fill priority sizes="(min-width: 800px) 45vw, 100vw" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-grape/30 via-sky to-flame/20">
            <Calendar className="h-8 w-8 text-snow/60" strokeWidth={1.5} />
            <p className="text-xs font-light uppercase tracking-[0.25em] text-snow/60">Einladung folgt</p>
          </div>
        )}
        <span className="glass absolute left-4 top-4 flex flex-col items-center rounded-2xl px-3 py-2 text-snow">
          <span className="text-xl font-semibold leading-none">{dayFmt.format(date)}</span>
          <span className="text-[0.625rem] font-medium uppercase tracking-widest">{monthFmt.format(date)}</span>
        </span>
      </div>
      <div className="flex flex-col justify-center p-6 lg:p-10">
        <span className="eyebrow self-start">Nächstes Event</span>
        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-snow lg:text-5xl">{event.title}</h2>
        <div className="mt-5 space-y-2 text-sm font-light text-snow/80">
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-snow/50" strokeWidth={1.8} />
            {dateFmt.format(date)} · {timeFmt.format(date)} Uhr
          </p>
          {event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-snow/50" strokeWidth={1.8} />
              {event.location}
            </p>
          )}
        </div>
        {event.description && <p className="mt-5 text-base font-light leading-relaxed text-snow/75">{event.description}</p>}
        {event.luma_url && (
          <a href={event.luma_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-7 self-start px-6 py-3.5 text-sm">
            <Ticket className="h-4 w-4" strokeWidth={2} />
            Sei mit dabei
          </a>
        )}
      </div>
    </article>
  );
}

function PastCard({ event }: { event: GridEvent }) {
  const date = new Date(event.starts_at);
  return (
    <article className="reveal glass rounded-[1.75rem] p-6">
      <p className="text-xs font-light text-snow/50">{dateFmt.format(date)}</p>
      <h3 className="mt-1 text-xl font-semibold tracking-tight text-snow">{event.title}</h3>
      {event.location && <p className="mt-0.5 text-sm font-light text-snow/60">{event.location}</p>}

      {event.showreel_url && <video src={event.showreel_url} controls playsInline preload="none" className="mt-4 w-full rounded-2xl" />}

      {/* Ohne Galerie zeigt die Karte wenigstens die Einladung. */}
      {event.cover_url && !event.showreel_url && !event.gallery?.length && (
        <div className="relative mx-auto mt-4 aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl">
          <Image src={event.cover_url} alt={event.title} fill sizes="(min-width: 800px) 384px, 100vw" className="object-cover" />
        </div>
      )}

      {event.gallery?.length ? (
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {event.gallery.map((src) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
              <Image src={src} alt={event.title} fill sizes="(min-width: 800px) 200px, 33vw" className="object-cover" />
            </div>
          ))}
        </div>
      ) : (
        !event.showreel_url &&
        !event.cover_url && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-snow/15 px-4 py-5">
            <Camera className="h-4 w-4 text-snow/30" strokeWidth={1.6} />
            <p className="text-xs font-light text-snow/40">Bilder &amp; Showreel folgen.</p>
          </div>
        )
      )}
    </article>
  );
}

export function EventsView({ upcoming, past }: { upcoming: GridEvent[]; past: GridEvent[] }) {

  return (
    <div>
      <PageHeader
        eyebrow="Events"
        title={
          <>
            Offline genauso <span className="text-aurora">unskippable</span> wie online.
          </>
        }
        text="Wir bringen Feeds ins echte Leben, mit unseren Brands, guter Musik und Content, der sich selbst dreht."
      >
        <a href="#vergangene-events" className="btn btn-glass mt-7 px-5 py-3 text-sm">
          Vergangene Events
          <ArrowDown className="h-4 w-4" strokeWidth={2} />
        </a>
      </PageHeader>

      <div className="mt-12 space-y-4 lg:mt-16">
        {upcoming.length > 0 ? (
          upcoming.map((e) => <UpcomingCard key={e.id} event={e} />)
        ) : (
          <div className="rise glass flex flex-col items-center gap-2 rounded-[2rem] py-14">
            <Clapperboard className="h-6 w-6 text-snow/40" strokeWidth={1.6} />
            <p className="text-sm font-light text-snow/60">Gerade nichts geplant, aber nicht mehr lange.</p>
          </div>
        )}
      </div>

      <section id="vergangene-events" className="mt-20 scroll-mt-28 lg:mt-28">
        <span className="eyebrow">Vergangene Events</span>
        {/* Ab Desktop zweispaltig, sonst werden die Titelbilder riesig. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* Grand Opening Casa Beef: dokumentiert auf der Kundenseite. */}
          <article className="reveal glass group overflow-hidden rounded-[1.75rem]">
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              <Image src="/referenzen/casa-beef/events-1.webp" alt="Grand Opening Casa Beef" fill sizes="(min-width: 800px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            </div>
            <div className="p-6">
              <p className="text-xs font-light text-snow/50">Dezember 2025</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-snow">Grand Opening Casa Beef</h3>
              <p className="mt-0.5 text-sm font-light text-snow/60">KaDeWe die Sechste, Berlin-Charlottenburg</p>
              <Link href="/projekte/casa-beef" className="btn btn-primary mt-5 px-5 py-3 text-sm">
                Bilder &amp; Reel ansehen
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
          </article>
          {past.map((e) => (
            <PastCard key={e.id} event={e} />
          ))}
        </div>
      </section>

      <p className="mt-14 text-center text-sm font-light text-snow/55">
        Du willst ein Event mit uns machen?{" "}
        <ContactLink tab="nachricht" className="font-medium text-snow underline-offset-4 hover:underline">
          Schreib uns →
        </ContactLink>
      </p>
    </div>
  );
}
