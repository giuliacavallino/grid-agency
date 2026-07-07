"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";

type TeaserEvent = { id: string; title: string; starts_at: string };

/** Glass banner under the hero CTAs pointing at the next upcoming event. */
export function EventTeaser() {
  const [event, setEvent] = useState<TeaserEvent | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("events")
      .select("id,title,starts_at")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data && data.length > 0) setEvent(data[0]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AnimatePresence>
      {event && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-3"
        >
          <Link
            href="/events"
            className="glass flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm text-snow transition-all active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-dune" strokeWidth={1.8} />
            <span className="min-w-0 flex-1 truncate font-light">
              <span className="font-medium">
                {new Date(event.starts_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: "Europe/Berlin",
                })}
              </span>{" "}
              — {event.title} · Sei dabei
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-dune" strokeWidth={1.8} />
          </Link>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
