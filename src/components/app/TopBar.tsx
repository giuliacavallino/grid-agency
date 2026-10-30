"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";
import { ContactLink, SectionLink } from "@/components/ui/ContactLink";
import { MainMenu } from "./MainMenu";

const pages = [
  { href: "/projekte", label: "Projekte" },
  { href: "/events", label: "Events" },
  { href: "/jobs", label: "Jobs" },
  { href: "/faq", label: "FAQ" },
  { href: "/ebook", label: "E-Book" },
];

/** Kopfleiste als schwebende Liquid-Glass-Pille, auf allen Seiten gleich.
 * Beim Scrollen wird sie kompakter und dichter. Desktop: Logo, Navigation,
 * CTA. Mobil: Logo, Termin-Pille, Menü. */
export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className="rise pointer-events-none fixed inset-x-0 top-0 z-40 pt-[calc(env(safe-area-inset-top)+10px)] lg:pt-4">
        <div className="mx-auto w-full max-w-frame px-4 lg:max-w-frame-wide lg:px-gutter">
          <div
            className={`glass pointer-events-auto flex w-full items-center justify-between rounded-full pl-5 pr-2 transition-all duration-500 ${
              scrolled ? "h-14 bg-sky/40 lg:h-14" : "h-14 lg:h-16"
            }`}
          >
            <SectionLink id="home" className="logo-rainbow flex items-center gap-2" >
              <Image src="/brand/grid_logo_snow.png" alt="GRID Agency, zur Startseite" width={96} height={25} priority className="h-[1.1875rem] w-auto lg:h-[1.375rem]" />
            </SectionLink>

            <nav aria-label="Hauptmenü" className="hidden items-center gap-1 text-sm font-normal text-snow/75 lg:flex">
              <SectionLink id="leistungen" className="nav-rainbow rounded-full px-3 py-2 xl:px-4">
                Leistungen
              </SectionLink>
              <SectionLink id="cases" className="nav-rainbow rounded-full px-3 py-2 xl:px-4">
                Cases
              </SectionLink>
              {pages.map((page) => {
                const current = pathname.startsWith(page.href);
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    aria-current={current ? "page" : undefined}
                    className={`nav-rainbow rounded-full px-3 py-2 xl:px-4 ${current ? "bg-snow/10 text-snow" : ""}`}
                  >
                    {page.label}
                  </Link>
                );
              })}
              <SectionLink id="team" className="nav-rainbow rounded-full px-3 py-2 xl:px-4">
                Über uns
              </SectionLink>
            </nav>

            <div className="flex items-center gap-1.5">
              <ContactLink tab="termin" className="btn btn-primary py-1.5 pl-4 pr-1.5 text-sm">
                <span className="hidden sm:inline">Erstgespräch buchen</span>
                <span className="sm:hidden">Termin</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky text-snow">
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </ContactLink>
              <button
                type="button"
                aria-label="Menü öffnen"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-snow transition hover:bg-snow/10 active:scale-90 lg:hidden"
              >
                <Menu className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MainMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
