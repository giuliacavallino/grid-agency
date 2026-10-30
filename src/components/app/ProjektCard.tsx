import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { clientSlug, type Client } from "@/lib/content";
import { logoWidth } from "@/lib/media";

/** Eine Projekt-Karte: Logo, Rubriken-Chips (was GRID gemacht hat),
 * Kurzbeschreibung, Content-Vorschau und Link auf die Projektseite.
 * Geteilt von Projektübersicht und Startseite. */
export function ProjektCard({ client, eager = false }: { client: Client; eager?: boolean }) {
  const logoHeight = Math.round(Math.min((client.height ?? 32) * 1.15, 48));
  return (
    <Link
      href={`/projekte/${clientSlug(client.name)}`}
      className="group card-rainbow glass flex h-full flex-col overflow-hidden rounded-[1.75rem] p-6"
    >
      <div className="flex h-14 items-center justify-between gap-4">
        {client.logo ? (
          <Image
            src={client.logo}
            alt={client.name}
            height={logoHeight}
            width={logoWidth(client.logo, logoHeight)}
            loading={eager ? "eager" : "lazy"}
            style={{ height: `${logoHeight / 16}rem`, width: "auto" }}
            className="max-w-[70%] object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-sm font-medium uppercase tracking-[0.15em] text-snow/70">{client.name}</span>
        )}
        <ArrowUpRight className="h-5 w-5 shrink-0 text-snow/40 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-snow" strokeWidth={2} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(client.tags ?? ["Social Media Management", "Content Creation"]).map((tag) => (
          <span key={tag} className="rounded-full bg-snow/[0.07] px-2.5 py-1 text-[0.6875rem] font-light text-snow/70">
            {tag}
          </span>
        ))}
      </div>

      {client.intro && <p className="mt-4 line-clamp-3 flex-1 text-sm font-light leading-relaxed text-snow/65">{client.intro}</p>}

      {client.heroImage && (
        <div className={`relative mt-5 overflow-hidden rounded-2xl ${client.heroImageFit === "contain" ? "h-48" : "aspect-[16/10]"}`}>
          <Image
            src={client.heroImage}
            alt={`${client.name}, Einblick in den Content`}
            fill
            sizes="(min-width: 800px) 33vw, 100vw"
            className={`${client.heroImageFit === "contain" ? "object-contain py-2" : "object-cover"} transition-transform duration-500 group-hover:scale-[1.04]`}
          />
        </div>
      )}
    </Link>
  );
}
