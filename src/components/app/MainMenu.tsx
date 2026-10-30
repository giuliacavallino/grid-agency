"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { ContactLink, SectionLink } from "@/components/ui/ContactLink";

type Item = { kind: "section"; id: string; label: string } | { kind: "page"; href: string; label: string };

const items: Item[] = [
  { kind: "section", id: "home", label: "Start" },
  { kind: "section", id: "leistungen", label: "Leistungen" },
  { kind: "section", id: "cases", label: "Case Studies" },
  { kind: "page", href: "/projekte", label: "Projekte" },
  { kind: "page", href: "/events", label: "Events" },
  { kind: "section", id: "team", label: "Über uns" },
  { kind: "page", href: "/jobs", label: "Jobs" },
  { kind: "page", href: "/faq", label: "FAQ" },
];

/** Vollbild-Menü (mobil) als Glasfläche. */
export function MainMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Portal an <body>: Vorfahren mit backdrop-filter würden sonst zum
  // Bezugsrahmen dieses fixierten Overlays.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const itemClass = "nav-rainbow block py-2 text-left text-[2rem] font-semibold tracking-[-0.03em] text-snow";

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Menü" className="fixed inset-0 z-[60] flex flex-col bg-sky/80 backdrop-blur-2xl [animation:rise_0.35s_var(--ease-spring)_backwards]">
      <div className="mx-auto flex w-full max-w-frame flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex h-12 items-center justify-between pl-1">
          <Image src="/brand/grid_logo_snow.png" alt="GRID" width={72} height={19} />
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={onClose}
            className="glass flex h-11 w-11 items-center justify-center rounded-full text-snow transition-transform active:scale-90"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <nav className="mt-8 flex flex-1 flex-col">
          {items.map((item, i) => (
            <div key={item.label} className="rise" style={{ "--d": `${40 + i * 35}ms` } as React.CSSProperties}>
              {item.kind === "section" ? (
                <SectionLink id={item.id} onNavigate={onClose} className={itemClass}>
                  {item.label}
                </SectionLink>
              ) : (
                <Link href={item.href} onClick={onClose} className={itemClass}>
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="rise mt-6 grid gap-2" style={{ "--d": "360ms" } as React.CSSProperties}>
          <ContactLink tab="termin" onNavigate={onClose} className="btn btn-primary py-3.5 text-[0.9375rem]">
            Erstgespräch buchen
            <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
          </ContactLink>
          <ContactLink tab="nachricht" onNavigate={onClose} className="btn btn-glass py-3.5 text-[0.9375rem]">
            Nachricht schreiben
          </ContactLink>
        </div>

        <div className="mt-6 flex items-center gap-5 text-sm font-light text-snow/50">
          <Link href="/impressum" onClick={onClose} className="hover:text-snow">
            Impressum
          </Link>
          <Link href="/datenschutz" onClick={onClose} className="hover:text-snow">
            Datenschutz
          </Link>
          <Link href="/agb" onClick={onClose} className="hover:text-snow">
            AGB
          </Link>
          <span className="ml-auto text-xs uppercase tracking-[0.2em] text-snow/30">Berlin · FFM</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
