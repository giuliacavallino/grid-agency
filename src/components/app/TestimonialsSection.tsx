"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { googleReviewsUrl, testimonials } from "@/lib/content";

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${count} von 5 Sternen`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < count ? "fill-[#feda75] text-[#feda75]" : "text-snow/20"}`}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

/** Kundenstimmen auf der Startseite: Google-Gesamtbewertung als Badge,
 * darunter echte Zitate aus den Bewertungen (aus content.ts, Wortlaut
 * unverändert). Ohne hinterlegte Zitate zeigt die Sektion nur das
 * Google-Badge mit Link. */
export function TestimonialsSection() {
  return (
    <div className="px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Kundenstimmen
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Was unsere Kunden
          <br />
          <span className="text-scroll-gradient">sagen</span>.
        </h2>
      </motion.div>

      {/* Google-Badge: Gesamtbewertung plus Link zu allen Bewertungen. */}
      <motion.a
        href={googleReviewsUrl}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="card-rainbow mt-6 flex items-center justify-between gap-4 rounded-2xl border border-snow/10 p-5"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-snow text-lg font-medium text-sky">
            G
          </span>
          <div>
            <p className="flex items-center gap-2 text-lg font-medium text-snow">
              5,0 <Stars count={5} />
            </p>
            <p className="text-xs font-light text-snow/60">
              Bewertungen auf Google
            </p>
          </div>
        </div>
        <span className="shrink-0 text-sm font-medium text-snow/80">
          Alle lesen →
        </span>
      </motion.a>

      {testimonials.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="flex flex-col rounded-2xl border border-snow/10 p-5"
            >
              <Stars count={t.rating ?? 5} />
              <blockquote className="mt-3 flex-1 text-sm font-light leading-relaxed text-snow/75">
                &bdquo;{t.quote}&ldquo;
              </blockquote>
              <figcaption className="mt-4">
                <p className="text-sm font-medium text-snow">{t.name}</p>
                {t.meta && (
                  <p className="text-xs font-light text-snow/50">{t.meta}</p>
                )}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      )}
    </div>
  );
}
