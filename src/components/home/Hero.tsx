import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, Heart, MessageCircle, Send, Star, TrendingUp } from "lucide-react";
import { clients, clientSlug, newestCollab } from "@/lib/content";
import type { GridEvent } from "@/lib/events";
import { ContactLink } from "@/components/ui/ContactLink";
import { HeroVideo } from "./HeroVideo";

const dateFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", timeZone: "Europe/Berlin" });

/** Ein Handy mit Instagram-Rahmen: Kopf mit Story-Ring, unten Aktionen. */
function Phone({
  handle,
  children,
  className = "",
}: {
  handle: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass rounded-[2.4rem] p-[7px] ${className}`}>
      <div className="relative aspect-[9/19] overflow-hidden rounded-[2rem] bg-black">
        {children}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/60 to-transparent px-3.5 pb-8 pt-4">
          <span className="story-ring flex h-7 w-7 shrink-0 rounded-full p-[1.5px]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-sky">
              <Image src="/brand/grid_monogram_snow.png" alt="" width={14} height={8} />
            </span>
          </span>
          <span className="truncate text-[0.6875rem] font-medium text-white">{handle}</span>
          <span className="ml-auto rounded-full border border-white/40 px-2 py-0.5 text-[0.5625rem] font-medium text-white">
            Folgen
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3.5 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-10 text-white">
          <Heart className="h-[1.125rem] w-[1.125rem] fill-pop text-pop" strokeWidth={2} />
          <MessageCircle className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
          <Send className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  value,
  label,
  className,
  delay,
}: {
  icon: typeof Eye;
  value: string;
  label: string;
  className: string;
  delay: number;
}) {
  return (
    <div className={`absolute z-10 ${className}`}>
      <div className="float glass flex items-center gap-2.5 rounded-2xl py-2.5 pl-2.5 pr-4" style={{ "--d": `${delay}ms` } as React.CSSProperties}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-snow text-sky">
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <span>
          <span className="block text-base font-semibold leading-tight tracking-tight text-snow lg:text-lg">{value}</span>
          <span className="block text-[0.6875rem] font-light text-snow/60">{label}</span>
        </span>
      </div>
    </div>
  );
}

export function Hero({ event }: { event: GridEvent | null }) {
  const collab = clients.find((c) => c.name === newestCollab);

  return (
    <section id="home" className="relative overflow-x-clip pt-28 lg:pt-40">
      <div aria-hidden className="grid-lines absolute inset-x-0 top-0 h-[52rem]" />
      <div aria-hidden className="absolute left-1/2 top-24 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-grape/25 blur-[110px]" />

      <div className="relative mx-auto w-full max-w-frame px-5 text-center lg:max-w-frame-wide lg:px-gutter">
        {/* News-Pille: anstehendes Event, sonst die neueste Zusammenarbeit */}
        <div className="rise flex justify-center">
          {event ? (
            <Link href="/events" className="glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-light text-snow/80 transition-colors hover:text-snow">
              <span className="rounded-full bg-snow px-2 py-0.5 font-medium text-sky">{dateFmt.format(new Date(event.starts_at))}</span>
              <span className="max-w-[14rem] truncate">{event.title}</span>
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          ) : collab ? (
            <Link href={`/projekte/${clientSlug(collab.name)}`} className="glass inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-light text-snow/80 transition-colors hover:text-snow">
              <span className="rounded-full bg-snow px-2 py-0.5 font-medium text-sky">Neu</span>
              {collab.name} ist jetzt im Grid
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          ) : null}
        </div>

        <h1
          className="rise mx-auto mt-6 max-w-[18ch] text-[clamp(2.6rem,11vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-snow lg:mt-8 lg:text-[clamp(4.5rem,7.2vw,8rem)]"
          style={{ "--d": "80ms" } as React.CSSProperties}
        >
          Marken, die man nicht <span className="text-aurora italic">wegscrollen</span> kann.
        </h1>

        <p
          className="rise mx-auto mt-5 max-w-[34rem] text-base font-light leading-relaxed text-snow/70 lg:mt-7 lg:text-xl"
          style={{ "--d": "160ms" } as React.CSSProperties}
        >
          Social-Media-Agentur aus Berlin &amp; Frankfurt. Strategie, Content-Produktion, Editing und Ads aus einer Hand. Dein
          Feed wird das Problem deiner Konkurrenz.
        </p>

        <div className="rise mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ "--d": "240ms" } as React.CSSProperties}>
          <ContactLink tab="termin" className="btn btn-primary w-full py-2 pl-6 pr-2 text-[0.9375rem] sm:w-auto">
            Kostenloses Erstgespräch
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky text-snow">
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </span>
          </ContactLink>
          <a href="#cases" className="btn btn-glass w-full px-6 py-3.5 text-[0.9375rem] sm:w-auto">
            Cases ansehen
          </a>
        </div>

        <div className="rise mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-light text-snow/55" style={{ "--d": "320ms" } as React.CSSProperties}>
          <span className="flex items-center gap-1.5">
            <span className="flex text-sun">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
              ))}
            </span>
            5,0 auf Sortlist
          </span>
          <span className="hidden h-3 w-px bg-snow/20 sm:block" />
          <span>30+ Marken im Grid</span>
          <span className="hidden h-3 w-px bg-snow/20 sm:block" />
          <span>Fotograf &amp; Videograf inklusive</span>
        </div>
      </div>

      {/* Bühne: drei Feeds, das Reel in der Mitte, Kennzahlen schweben davor */}
      <div className="rise relative mx-auto mt-14 h-[30rem] w-full max-w-[64rem] px-5 lg:mt-20 lg:h-[40rem]" style={{ "--d": "380ms" } as React.CSSProperties}>
        <Phone handle="480gradi" className="absolute left-1/2 top-12 w-[11.5rem] -translate-x-[118%] -rotate-[8deg] opacity-90 lg:w-[15.5rem]">
          <Image src="/referenzen/480-gradi/21.webp" alt="480 GRADI, Pizza am Tisch" fill sizes="(min-width: 800px) 248px, 184px" className="object-cover" />
        </Phone>
        <Phone handle="casabeef.berlin" className="absolute left-1/2 top-12 w-[11.5rem] translate-x-[18%] rotate-[8deg] opacity-90 lg:w-[15.5rem]">
          <Image src="/referenzen/casa-beef/27.webp" alt="Casa Beef, aufgeschnittenes Steak" fill sizes="(min-width: 800px) 248px, 184px" className="object-cover" />
        </Phone>
        <Phone handle="grid.berlin" className="absolute left-1/2 top-0 z-[5] w-[13.5rem] -translate-x-1/2 lg:w-[18rem]">
          <Image src="/hero/poster-portrait.jpg" alt="" fill priority sizes="(min-width: 800px) 288px, 216px" className="object-cover" />
          <HeroVideo src="/hero/loop-portrait.mp4" poster="/hero/poster-portrait.jpg" />
        </Phone>

        <Kpi icon={TrendingUp} value="+875 %" label="Reichweite im Schnitt" className="left-[2%] top-[58%] lg:left-[4%] lg:top-[44%]" delay={0} />
        <Kpi icon={Eye} value="450.000" label="neue Profilaufrufe" className="right-[2%] top-[8%] lg:right-[6%] lg:top-[14%]" delay={1200} />
        <Kpi icon={Heart} value="+150 %" label="mehr Likes" className="bottom-[2%] right-[6%] hidden sm:block lg:bottom-[10%] lg:right-[2%]" delay={2400} />

        <div aria-hidden className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-sky to-transparent" />
      </div>
    </section>
  );
}
