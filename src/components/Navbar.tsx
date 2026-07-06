"use client";

import Image from "next/image";
import { useState } from "react";

const links = [
  { href: "#leistungen", label: "Leistungen" },
  { href: "#arbeiten", label: "Arbeiten" },
  { href: "#prozess", label: "Prozess" },
  { href: "#kontakt", label: "Kontakt" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-snow/10 bg-sky/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center">
          <Image
            src="/brand/grid_logo_snow.png"
            alt="GRID Agency"
            width={110}
            height={29}
            priority
          />
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-light text-snow/80 transition-colors hover:text-snow"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href="#kontakt"
          className="hidden rounded-full bg-snow px-5 py-2.5 text-sm font-medium text-sky transition-transform hover:scale-105 md:inline-block"
        >
          Projekt starten
        </a>

        <button
          className="text-snow md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menü öffnen"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-snow/10 px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-4">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-light text-snow/80"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#kontakt"
                className="inline-block rounded-full bg-snow px-5 py-2.5 text-sm font-medium text-sky"
                onClick={() => setOpen(false)}
              >
                Projekt starten
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
