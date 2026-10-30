import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clients, clientSlug, newestCollab } from "@/lib/content";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Galerien sind nach Shooting sortiert; mit einer zur Länge teilerfremden
 * Schrittweite rücken ähnliche Bilder auseinander (deterministisch). */
function spread(list: string[]) {
  const step = [7, 5, 3, 2].find((k) => gcd(list.length, k) === 1) ?? 1;
  return list.map((_, i) => list[(i * step) % list.length]);
}

const shots = [
  { src: "/referenzen/casa-beef/27.webp", client: "Casa Beef" },
  { src: "/referenzen/casa-beef/events-12.webp", client: "Casa Beef" },
  { src: "/referenzen/casa-beef/12.webp", client: "Casa Beef" },
  { src: "/referenzen/casa-beef/37.webp", client: "Casa Beef" },
  { src: "/referenzen/casa-beef/events-3.webp", client: "Casa Beef" },
  { src: "/referenzen/casa-beef/52.webp", client: "Casa Beef" },
];

/** „Frisch aus dem Ofen“: die neueste Zusammenarbeit plus starke Shots aus
 * echten Produktionen als Laufband. Feste Kachelgröße, damit lazy
 * geladene Bilder den Loop nie verschieben. */
export function Feed() {
  const collab = clients.find((c) => c.name === newestCollab);
  const collabShots = spread(collab?.gallery ?? []).slice(0, 8).map((src) => ({ src, client: collab!.name }));
  const tiles = collabShots.flatMap((s, i) => (shots[i] ? [s, shots[i]] : [s]));
  if (tiles.length === 0) return null;
  const href = collab ? `/projekte/${clientSlug(collab.name)}` : "/projekte";

  return (
    <section className="relative py-20 lg:py-28">
      <div className="mx-auto flex w-full max-w-frame flex-col gap-6 px-5 lg:max-w-frame-wide lg:flex-row lg:items-end lg:justify-between lg:px-gutter">
        <div className="reveal">
          <span className="eyebrow">Frisch aus dem Ofen</span>
          <h2 className="mt-4 text-[2.25rem] font-semibold leading-[1.02] tracking-[-0.03em] text-snow lg:text-[clamp(3rem,4.6vw,4.5rem)]">
            Content, der <span className="text-aurora">Hunger</span> macht.
          </h2>
        </div>
        {collab && (
          <Link href={href} className="reveal btn btn-glass self-start px-5 py-3 text-sm lg:self-auto">
            Neu: {collab.name}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}
      </div>

      <div className="fade-x mt-10 overflow-hidden">
        <div className="marquee flex w-max" style={{ "--marquee-duration": `${tiles.length * 4}s` } as React.CSSProperties}>
          {[...tiles, ...tiles].map((tile, i) => (
            <Link
              key={`${tile.src}-${i}`}
              href={`/projekte/${clientSlug(tile.client)}`}
              tabIndex={i >= tiles.length ? -1 : undefined}
              className={`relative mr-3 block h-[22rem] shrink-0 overflow-hidden rounded-[1.5rem] lg:mr-4 lg:h-[30rem] ${i % 3 === 1 ? "aspect-[3/4]" : "aspect-[4/5]"}`}
            >
              <Image
                src={tile.src}
                alt={i >= tiles.length ? "" : `${tile.client}, Einblick`}
                fill
                sizes="(min-width: 800px) 384px, 280px"
                loading={i < 4 ? "eager" : "lazy"}
                className="object-cover transition-transform duration-700 hover:scale-105"
              />
              <span className="glass-dark absolute bottom-3 left-3 rounded-full px-3 py-1 text-[0.6875rem] font-medium text-snow">{tile.client}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
