"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Camera, Clapperboard, MapPin, Ticket } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type GridEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  luma_url: string | null;
  cover_url: string | null;
  gallery: string[];
  showreel_url: string | null;
};

// Event times are wall-clock times in Germany, regardless of visitor TZ.
const TZ = "Europe/Berlin";
const dateFmt = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: TZ,
});
const timeFmt = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});
const dayFmt = new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: TZ });
const monthFmt = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  timeZone: TZ,
});

function UpcomingCard({ event }: { event: GridEvent }) {
  const date = new Date(event.starts_at);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass overflow-hidden rounded-3xl"
    >
      {/* Invitations come as 4:5 story-style artwork; the empty state is flatter. */}
      <div
        className={`relative w-full ${event.cover_url ? "aspect-[4/5]" : "aspect-[4/3]"}`}
      >
        {event.cover_url ? (
          <Image
            src={event.cover_url}
            alt={event.title}
            fill
            sizes="(max-width: 560px) 100vw, 520px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-earth/60 via-sky to-sky">
            <Calendar className="h-8 w-8 text-dune" strokeWidth={1.5} />
            <p className="text-xs font-light uppercase tracking-[0.25em] text-dune">
              Einladung folgt
            </p>
          </div>
        )}
        <span className="glass absolute left-4 top-4 flex flex-col items-center rounded-2xl px-3 py-2 text-snow">
          <span className="text-lg font-semibold leading-none">
            {dayFmt.format(date)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest">
            {monthFmt.format(date)}
          </span>
        </span>
      </div>

      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Nächstes Event
        </p>
        <h2 className="mt-1.5 text-2xl font-medium tracking-tight text-snow">
          {event.title}
        </h2>

        <div className="mt-3 space-y-1.5 text-sm font-light text-snow/70">
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0 text-dune" strokeWidth={1.8} />
            {dateFmt.format(date)} · {timeFmt.format(date)} Uhr
          </p>
          {event.location && (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-dune" strokeWidth={1.8} />
              {event.location}
            </p>
          )}
        </div>

        {event.description && (
          <p className="mt-4 text-sm font-light leading-relaxed text-snow/75">
            {event.description}
          </p>
        )}

        {event.luma_url && (
          <a
            href={event.luma_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex items-center justify-center gap-2 rounded-full bg-snow py-3 text-sm font-medium text-sky transition-all active:scale-[0.97]"
          >
            <Ticket className="h-4 w-4" strokeWidth={2} />
            Sei mit dabei
          </a>
        )}
      </div>
    </motion.div>
  );
}

function PastCard({ event }: { event: GridEvent }) {
  const date = new Date(event.starts_at);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.5 }}
      className="glass rounded-3xl p-5"
    >
      <p className="text-xs font-light text-snow/50">{dateFmt.format(date)}</p>
      <h3 className="mt-1 text-lg font-medium text-snow">{event.title}</h3>
      {event.location && (
        <p className="mt-0.5 text-sm font-light text-snow/60">
          {event.location}
        </p>
      )}

      {event.showreel_url && (
        <video
          src={event.showreel_url}
          controls
          playsInline
          preload="metadata"
          className="mt-4 w-full rounded-2xl"
        />
      )}

      {event.gallery.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {event.gallery.map((src) => (
            <div
              key={src}
              className="relative aspect-square overflow-hidden rounded-xl"
            >
              <Image
                src={src}
                alt={event.title}
                fill
                sizes="(max-width: 560px) 33vw, 170px"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        !event.showreel_url && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-snow/15 px-4 py-5">
            <Camera className="h-4 w-4 text-snow/30" strokeWidth={1.6} />
            <p className="text-xs font-light text-snow/40">
              Bilder & Showreel folgen.
            </p>
          </div>
        )
      )}
    </motion.div>
  );
}

type EventLists = { upcoming: GridEvent[]; past: GridEvent[] };

export function EventsView() {
  const [lists, setLists] = useState<EventLists | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("events")
      .select("*")
      .order("starts_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const now = Date.now();
        const all = data as GridEvent[];
        setLists({
          upcoming: all
            .filter((e) => new Date(e.starts_at).getTime() >= now)
            .sort(
              (a, b) =>
                new Date(a.starts_at).getTime() -
                new Date(b.starts_at).getTime(),
            ),
          past: all.filter((e) => new Date(e.starts_at).getTime() < now),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = lists?.upcoming ?? [];
  const past = lists?.past ?? [];

  return (
    <div className="px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          Events
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Offline genauso
          <br />
          unskippable wie online.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm font-light leading-relaxed text-snow/60">
          Wir bringen Feeds ins echte Leben — mit unseren Brands, guter Musik
          und Content, der sich selbst dreht.
        </p>
      </motion.div>

      <div className="mt-8 space-y-4">
        {lists === null ? (
          <div className="glass skeleton h-72 rounded-3xl" />
        ) : upcoming.length > 0 ? (
          upcoming.map((e) => <UpcomingCard key={e.id} event={e} />)
        ) : (
          <div className="glass flex flex-col items-center gap-2 rounded-3xl py-12">
            <Clapperboard className="h-6 w-6 text-snow/30" strokeWidth={1.6} />
            <p className="text-sm font-light text-snow/50">
              Gerade nichts geplant — aber nicht mehr lange.
            </p>
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
            Vergangene Events
          </p>
          <div className="mt-4 space-y-4">
            {past.map((e) => (
              <PastCard key={e.id} event={e} />
            ))}
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-sm font-light text-snow/50">
        Du willst ein Event mit uns machen?{" "}
        <Link
          href="/#dm"
          className="font-medium text-dune underline-offset-4 hover:underline"
        >
          Schreib uns →
        </Link>
      </p>
    </div>
  );
}
