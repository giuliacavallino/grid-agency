import Link from "next/link";

/** Standorte, Kontakt und Rechtliches: derselbe Footer auf der Startseite
 * (unter dem Kontaktformular) und auf allen Unterseiten. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <div
      className={`space-y-1 text-center text-[0.6875rem] font-light text-snow/35 ${className ?? ""}`}
    >
      {/* Beide Standorte; auf schmalen Screens bricht die Zeile zwischen
          den Adressen um, nie mitten in einer Adresse. */}
      <p>
        <span className="whitespace-nowrap">Sömmeringstraße 37, 10589 Berlin</span>
        <span className="hidden sm:inline lg:hidden">{" · "}</span>
        <br className="sm:hidden lg:inline" />
        <span className="whitespace-nowrap">
          Eichendorffstraße 32, 60320 Frankfurt am Main
        </span>
      </p>
      <p>
        <a href="mailto:hello@grid-agency.de" className="hover:text-snow/60">
          hello@grid-agency.de
        </a>
        {" · "}
        <a href="tel:+4915122910161" className="hover:text-snow/60">
          +49 1512 2910161
        </a>
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 lg:justify-start">
        <Link href="/impressum" className="hover:text-snow/60">
          Impressum
        </Link>
        <Link href="/datenschutz" className="hover:text-snow/60">
          Datenschutz
        </Link>
        <Link href="/agb" className="hover:text-snow/60">
          AGB
        </Link>
        <a href="https://intranet.grid-agency.de" className="hover:text-snow/60">
          Login
        </a>
      </p>
    </div>
  );
}
