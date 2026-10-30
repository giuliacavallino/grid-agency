import Image from "next/image";
import Link from "next/link";
import { clients, clientSlug } from "@/lib/content";
import { logoWidth } from "@/lib/media";

/** „Serving the coolest brands“: alle Kundenlogos als Laufband. Jedes Logo
 * hat vorab seine Breite, darum kann die zweite Hälfte lazy laden, ohne
 * dass der Loop springt. Hover hält das Band an, jedes Logo verlinkt. */
export function LogoMarquee() {
  const logos = clients.filter((c) => c.logo);
  return (
    <section aria-label="Unsere Kund:innen" className="relative py-10 lg:py-14">
      <p className="text-center text-xs font-medium uppercase tracking-[0.3em] text-snow/40">Serving the coolest brands</p>
      <div className="fade-x mt-7 overflow-hidden">
        <div className="marquee flex w-max items-center" style={{ "--marquee-duration": `${logos.length * 2.2}s` } as React.CSSProperties}>
          {[...logos, ...logos].map((client, i) => {
            const height = Math.round((client.height ?? 32) * 0.9);
            return (
              <Link
                key={`${client.name}-${i}`}
                href={`/projekte/${clientSlug(client.name)}`}
                aria-label={`${client.name}, Projekt ansehen`}
                tabIndex={i >= logos.length ? -1 : undefined}
                className="mr-12 shrink-0 opacity-70 grayscale transition duration-300 hover:scale-110 hover:opacity-100 hover:grayscale-0"
              >
                <Image
                  src={client.logo!}
                  alt={i >= logos.length ? "" : client.name}
                  height={height}
                  width={logoWidth(client.logo!, height)}
                  loading={i < 10 ? "eager" : "lazy"}
                  sizes={`${logoWidth(client.logo!, height)}px`}
                  style={{ height: `${height / 16}rem`, width: "auto" }}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
