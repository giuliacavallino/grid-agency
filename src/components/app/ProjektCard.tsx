"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clientSlug, type Client } from "@/lib/content";

/** Eine Projekt-Karte: Logo, Rubriken-Chips (was GRID gemacht hat),
 * Kurzbeschreibung und Link auf die Projektseite. Wird von der
 * Projektübersicht und dem Startseiten-Teaser geteilt. */
export function ProjektCard({
  client,
  eager = false,
}: {
  client: Client;
  eager?: boolean;
}) {
  return (
    <Link
      href={`/projekte/${clientSlug(client.name)}`}
      className="card-rainbow group flex h-full flex-col rounded-2xl border border-snow/10 p-5"
    >
      <div className="flex h-16 items-center">
        {client.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logo}
            alt={client.name}
            style={{ height: Math.min((client.height ?? 32) * 1.15, 48) }}
            className="w-auto max-w-[70%] object-contain opacity-90 transition-transform duration-300 ease-out group-hover:scale-105"
            loading={eager ? "eager" : "lazy"}
          />
        ) : (
          <span className="text-sm font-light uppercase tracking-[0.15em] text-snow/60">
            {client.name}
          </span>
        )}
      </div>

      {/* Rubriken: was GRID für dieses Projekt gemacht hat. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(client.tags ?? ["Social Media Management", "Content Creation"]).map(
          (tag) => (
            <span
              key={tag}
              className="rounded-full border border-snow/15 px-2.5 py-0.5 text-[11px] font-light text-snow/65"
            >
              {tag}
            </span>
          ),
        )}
      </div>

      {client.intro && (
        <p className="mt-3 flex-1 text-sm font-light leading-relaxed text-snow/65">
          {client.intro}
        </p>
      )}

      {/* Content-Vorschau: Fotos füllen die Fläche, freigestellte
          Mockups stehen frei auf dem Kartengrund. */}
      {client.heroImage && (
        <div className="mt-4 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={client.heroImage}
            alt={`${client.name}, Einblick in den Content`}
            loading="lazy"
            className={
              client.heroImageFit === "contain"
                ? "mx-auto h-48 w-auto object-contain py-2 transition-transform duration-300 group-hover:scale-[1.03]"
                : "aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            }
          />
        </div>
      )}

      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-snow/75 transition-colors group-hover:text-snow">
        Projekt ansehen
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </span>
    </Link>
  );
}
