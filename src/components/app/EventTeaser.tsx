"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type TeaserEvent = { id: string; title: string; starts_at: string };

/** "GRID News" block below the logo band: black card pointing at the
 * next upcoming event. Renders nothing while no event is scheduled.
 * With `match`, it only shows events whose title mentions that brand
 * (used on client pages: "Event nicht verpassen"). */
export function EventTeaser({ match }: { match?: string } = {}) {
  const [event, setEvent] = useState<TeaserEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("events")
      .select("id,title,starts_at")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(10)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const hit = match
          ? data.find((e) =>
              e.title.toLowerCase().includes(match.toLowerCase()),
            )
          : data[0];
        if (hit) setEvent(hit);
      });
    return () => {
      cancelled = true;
    };
  }, [match]);

  return (
    <AnimatePresence>
      {event && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-12"
        >
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
            {match ? "Nicht verpassen" : "GRID News"}
          </p>
          <Link
            href="/events"
            className="mt-3 flex items-center gap-4 rounded-2xl bg-black p-4 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-snow text-sky">
              <span className="text-base font-semibold leading-none">
                {new Date(event.starts_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  timeZone: "Europe/Berlin",
                })}
              </span>
              <span className="text-[9px] font-medium uppercase tracking-widest">
                {new Date(event.starts_at).toLocaleDateString("de-DE", {
                  month: "short",
                  timeZone: "Europe/Berlin",
                })}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-dune">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} />
                {match ? "Jetzt Event nicht verpassen" : "Anstehendes Event"}
              </span>
              <span className="mt-0.5 block truncate text-base font-medium text-snow">
                {event.title}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-scroll-gradient">
              Sei dabei
              <ArrowRight className="h-4 w-4 text-dune" strokeWidth={2} />
            </span>
          </Link>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
