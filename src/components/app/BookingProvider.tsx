"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { BookingWidget } from "@/components/BookingWidget";

/** Terminbuchung als kleines Fenster direkt auf der Seite (unten rechts wie
 * ein Chat-Widget, mobil unten mittig), ohne Abdunkeln oder Blur. Die freien
 * Termine kommen aus unserem eigenen Kalender, es wird kein Drittanbieter
 * geladen. Ohne JS oder per Mittelklick führt der Link auf /termin. */

const BookingContext = createContext<{ open: () => void } | null>(null);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  // Escape schließt. Die Seite dahinter bleibt sichtbar und scrollbar,
  // das Fenster liegt einfach als Karte darüber.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  return (
    <BookingContext.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="termin"
            role="dialog"
            aria-modal="true"
            aria-label="Erstgespräch buchen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-end justify-center p-3 lg:justify-end lg:p-6"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-[min(78dvh,580px)] w-full max-w-[23.125rem] flex-col overflow-hidden rounded-2xl border border-snow/20 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.4)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between bg-sky px-4 py-2.5">
                <div>
                  <p className="text-[0.625rem] font-medium uppercase tracking-[0.2em] text-dune">Erstgespräch · 30 Minuten</p>
                  <p className="text-[0.8125rem] font-medium text-snow">Boost your Socials, unverbindlich</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Schließen"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-snow/20 text-snow transition-transform hover:bg-snow/10 active:scale-90"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <BookingWidget />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BookingContext.Provider>
  );
}

/** Buchungs-Link, der das Fenster öffnet. Fällt ohne Provider oder JS auf
 * die Seite /termin zurück. */
export function BookingLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const ctx = useContext(BookingContext);
  return (
    <a
      href="/termin"
      className={className}
      onClick={(e) => {
        if (!ctx || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        ctx.open();
      }}
    >
      {children}
    </a>
  );
}
