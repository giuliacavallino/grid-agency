"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Heart, Menu, Send } from "lucide-react";
import { motion } from "framer-motion";
import { scrollToId } from "@/lib/scroll";
import { MainMenu } from "./MainMenu";

/** Kopfleiste als schwebende Glas-Pill auf der Frame-Breite. Desktop:
 * Logo mit Subline links, Navigation und große CTA-Pill mit Pfeil-Badge
 * rechts. Mobile: Logo plus die drei Icons. */
export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToId(id);
  };

  return (
    <>
      <motion.header
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none fixed inset-x-0 top-0 z-40 pt-[calc(env(safe-area-inset-top)+12px)] lg:pt-6"
      >
        <div className="mx-auto w-full max-w-frame px-5 lg:max-w-frame-lg">
          <div className="glass pointer-events-auto relative flex h-12 w-full items-center justify-between overflow-hidden rounded-full px-5 lg:h-[68px] lg:px-7">
            <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />

            <a
              href="#home"
              aria-label="Nach oben"
              className="logo-rainbow relative flex flex-col items-start gap-1"
              onClick={jump("home")}
            >
              <Image
                src="/brand/grid_logo_snow.png"
                alt="GRID"
                width={96}
                height={25}
                priority
                className="h-[19px] w-auto lg:h-[23px]"
              />
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.32em] text-snow/70 lg:block">
                Social Media Agency
              </span>
            </a>

            <nav className="relative hidden items-center gap-8 text-[15px] font-normal text-snow/80 lg:flex">
              <a href="#leistungen" onClick={jump("leistungen")} className="nav-rainbow">
                Leistungen
              </a>
              <a href="#team" onClick={jump("team")} className="nav-rainbow">
                Über uns
              </a>
              <Link href="/projekte" className="nav-rainbow">
                Projekte
              </Link>
              <Link href="/events" className="nav-rainbow">
                Events
              </Link>
              <a href="#team" onClick={jump("team")} className="nav-rainbow">
                Jobs
              </a>
              <a
                href="#dm"
                onClick={jump("dm")}
                className="btn-rainbow ml-2 flex items-center gap-2.5 rounded-full bg-snow py-2.5 pl-5 pr-2.5 text-[15px] font-medium text-sky active:scale-95"
              >
                Slide in die DMs
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky text-snow">
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              </a>
            </nav>

            <div className="relative flex items-center gap-5 lg:hidden">
              <button
                aria-label="Aktivität"
                className="relative text-snow transition-transform active:scale-90"
              >
                <Heart className="h-[22px] w-[22px]" strokeWidth={1.8} />
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-dune" />
              </button>
              <a
                href="#dm"
                aria-label="Nachricht schreiben"
                className="text-snow transition-transform active:scale-90"
                onClick={jump("dm")}
              >
                <Send className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </a>
              <button
                aria-label="Menü öffnen"
                onClick={() => setMenuOpen(true)}
                className="text-snow transition-transform active:scale-90"
              >
                <Menu className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      <MainMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
