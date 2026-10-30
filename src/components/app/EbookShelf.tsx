"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { ebooks } from "@/lib/content";

/** Menüpunkt „E-Books“ der Kopfleiste (Desktop): Beim Rüberfahren oder
 * Fokussieren klappt darunter ein Regal mit allen E-Books auf, Cover
 * stehen auf einem Regalbrett, darunter Band, Seiten, Titel und Link.
 * Ein kurzer Schließ-Verzug lässt die Maus vom Menüpunkt ins Regal
 * wandern, ohne dass es zuklappt. */
export function EbookShelf({ current }: { current: boolean }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hide();
      }}
    >
      <Link
        href={ebooks[0]?.href ?? "/ebook"}
        aria-current={current ? "page" : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(false)}
        className={`nav-rainbow flex items-center gap-1 rounded-full px-3 py-2 xl:px-4 ${current || open ? "bg-snow/10 text-snow" : ""}`}
      >
        E-Books
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      </Link>

      {/* pt-4 überbrückt den Abstand zur Kopfleiste, damit das Regal beim
          Rüberfahren nicht zuklappt. */}
      <div
        className={`absolute left-1/2 top-full -translate-x-1/2 pt-4 transition-all duration-300 ${
          open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}
      >
        {/* Deckend statt Glas: In der gläsernen Kopfleiste greift ein
            weiterer backdrop-filter nicht. */}
        <div
          className="rounded-[1.75rem] px-12 pb-8 pt-7"
          style={{
            background: "rgb(31 29 27)",
            border: "1px solid rgb(245 243 247 / 0.12)",
            boxShadow: "0 24px 60px rgb(0 0 0 / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.08)",
          }}
        >
          <p className="whitespace-nowrap text-center text-[0.6875rem] font-medium uppercase tracking-[0.25em] text-dune">
            Kostenlose E-Books · mit Fahrplan &amp; Checklisten
          </p>

          <ul className="relative mt-6 flex justify-center gap-10">
            {/* Regalbrett auf Höhe der Cover-Unterkante (h-60) */}
            <li
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 top-60 h-2 rounded-full bg-gradient-to-b from-snow/15 to-snow/[0.03] shadow-[0_10px_18px_rgb(0_0_0/0.45)]"
            />
            {ebooks.map((book) => (
              <li key={book.href} className="w-52">
                <Link
                  href={book.href}
                  onClick={() => setOpen(false)}
                  className="group block text-center"
                >
                  <div className="relative flex h-60 items-end justify-center [perspective:900px]">
                    <div
                      aria-hidden
                      className="absolute bottom-6 h-32 w-32 rounded-full bg-[linear-gradient(92deg,#feda75,#fa7e1e,#d62976,#962fbf)] opacity-20 blur-3xl transition-opacity duration-500 group-hover:opacity-40"
                    />
                    <Image
                      src={book.cover}
                      alt={`Cover: ${book.title}`}
                      width={160}
                      height={226}
                      className="relative w-36 rounded-[3px] shadow-[8px_12px_24px_rgb(0_0_0/0.55),inset_0_0_0_1px_rgb(255_255_255/0.06)] transition-transform duration-500 [transform:rotateY(-14deg)] group-hover:-translate-y-2 group-hover:[transform:rotateY(0deg)]"
                    />
                  </div>
                </Link>
                <div className="mt-6 text-center">
                  <p className="text-[0.6875rem] font-medium uppercase tracking-[0.2em] text-dune">
                    Band {book.band} · {book.pages} Seiten
                  </p>
                  <p className="mt-1.5 text-base font-medium leading-snug text-snow">
                    {book.title}
                  </p>
                  <p className="mt-1 text-sm font-light leading-relaxed text-snow/60">
                    {book.subtitle}
                  </p>
                  <Link
                    href={book.href}
                    onClick={() => setOpen(false)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-snow transition-colors hover:text-dune"
                  >
                    Kostenlos lesen
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
