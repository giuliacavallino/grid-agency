"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Menu, Send } from "lucide-react";
import { motion } from "framer-motion";
import { scrollToId } from "@/lib/scroll";
import { MainMenu } from "./MainMenu";

const desktopSections = [
  { id: "prozess", label: "Leistungen" },
  { id: "team", label: "Über uns" },
] as const;

export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <motion.header
        initial={{ y: -72, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none fixed inset-x-0 top-0 z-40 px-5 pt-[calc(env(safe-area-inset-top)+12px)] lg:pt-7"
      >
        {/* glass-dark keeps the bar legible over the white hero and the
            dark sections alike; on desktop it widens into a real header
            with the GRID mark on the far left. */}
        <div className="glass-dark pointer-events-auto relative mx-auto flex h-12 w-full max-w-[520px] items-center justify-between overflow-hidden rounded-full px-5 lg:w-fit lg:max-w-none lg:gap-9 lg:px-7">
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />
          <a
            href="#home"
            aria-label="Nach oben"
            className="logo-rainbow relative"
            onClick={(e) => {
              e.preventDefault();
              scrollToId("home");
            }}
          >
            <Image
              src="/brand/grid_logo_snow.png"
              alt="GRID"
              width={72}
              height={19}
              priority
            />
          </a>

          <nav className="relative hidden items-center gap-7 text-sm font-light text-snow/80 lg:flex">
            {desktopSections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToId(s.id);
                }}
                className="nav-rainbow"
              >
                {s.label}
              </a>
            ))}
            <Link href="/referenzen" className="nav-rainbow">
              Referenzen
            </Link>
            <Link href="/events" className="nav-rainbow">
              Events
            </Link>
            <a
              href="#team"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("team");
              }}
              className="nav-rainbow"
            >
              Jobs
            </a>
            <a
              href="#dm"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("dm");
              }}
              className="btn-rainbow flex items-center gap-1.5 rounded-full bg-snow px-4 py-1.5 font-medium text-sky active:scale-95"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
              Slide in die DMs
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
              onClick={(e) => {
                e.preventDefault();
                scrollToId("dm");
              }}
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
      </motion.header>

      <MainMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
