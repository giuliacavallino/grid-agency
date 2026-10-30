import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ContactLink, SectionLink } from "@/components/ui/ContactLink";

const columns: { title: string; links: { label: string; href?: string; section?: string; contact?: "termin" | "nachricht" }[] }[] = [
  {
    title: "Agentur",
    links: [
      { label: "Leistungen", section: "leistungen" },
      { label: "Über uns", section: "team" },
      { label: "Projekte", href: "/projekte" },
      { label: "Events", href: "/events" },
      { label: "Jobs", href: "/jobs" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Kontakt",
    links: [
      { label: "Erstgespräch buchen", contact: "termin" },
      { label: "Nachricht schreiben", contact: "nachricht" },
      { label: "Login Intranet", href: "https://intranet.grid-agency.de" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { label: "Impressum", href: "/impressum" },
      { label: "Datenschutz", href: "/datenschutz" },
      { label: "AGB", href: "/agb" },
    ],
  },
];

/** Footer auf allen Seiten: CTA-Band, Standorte, Navigation, Rechtliches.
 * Kontakt läuft über Formular und Buchung (→ Pipeline), nicht per Mail. */
export function SiteFooter() {
  return (
    <footer className="relative mx-auto w-full max-w-frame px-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-10 lg:max-w-frame-wide lg:px-gutter lg:pb-10">
      <div className="glass relative overflow-hidden rounded-[2rem] p-7 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:p-12">
        <div aria-hidden className="aurora absolute inset-0 opacity-80" />
        <div className="relative">
          <p className="text-[2rem] font-semibold leading-[1.02] tracking-[-0.03em] text-snow lg:text-5xl">
            Bereit, nicht mehr <span className="text-aurora">weggescrollt</span> zu werden?
          </p>
          <p className="mt-3 text-sm font-light text-snow/65 lg:text-base">30 Minuten, kostenlos, mit Giulia. Direkt im Kalender buchen.</p>
        </div>
        <ContactLink tab="termin" className="btn btn-primary relative mt-6 py-2 pl-6 pr-2 text-[0.9375rem] lg:mt-0">
          Erstgespräch buchen
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky text-snow">
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </span>
        </ContactLink>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Image src="/brand/grid_logo_snow.png" alt="GRID Agency" width={96} height={25} className="h-6 w-auto" />
          <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-snow/55">
            Social-Media-Agentur für Marken, die man nicht wegscrollen kann.
          </p>
          <p className="mt-4 text-xs font-light leading-relaxed text-snow/40">
            Sömmeringstraße 37, 10589 Berlin
            <br />
            Eichendorffstraße 32, 60320 Frankfurt am Main
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-snow/40">{col.title}</p>
            <ul className="mt-4 space-y-2.5 text-sm font-light text-snow/70">
              {col.links.map((link) => (
                <li key={link.label}>
                  {link.contact ? (
                    <ContactLink tab={link.contact} className="transition-colors hover:text-snow">
                      {link.label}
                    </ContactLink>
                  ) : link.section ? (
                    <SectionLink id={link.section} className="transition-colors hover:text-snow">
                      {link.label}
                    </SectionLink>
                  ) : (
                    <Link href={link.href!} className="transition-colors hover:text-snow">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-snow/10 pt-6 text-xs font-light text-snow/35 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} GRID Agency UG (haftungsbeschränkt)</p>
        <p>Made with ♥ in Berlin &amp; Frankfurt</p>
      </div>
    </footer>
  );
}
