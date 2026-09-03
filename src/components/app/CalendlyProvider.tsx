"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { calendlyUrl } from "@/lib/content";

/** Calendly als Popup direkt auf der Seite: Der Kalender lädt erst nach
 * dem Klick in einem Overlay (iframe), nicht beim Seitenaufruf. So
 * bleibt der erste Aufruf frei von Calendly-Requests, und ohne JS oder
 * per Mittelklick führt der normale Link weiter auf calendly.com. */

const CalendlyContext = createContext<{ open: () => void } | null>(null);

/** Embed-Parameter: dunkler Hintergrund und Snow-Text passend zur
 * Website, Akzent im Story-Orange. Die Farben gelten für die
 * Terminauswahl; das Calendly-Branding hängt vom Calendly-Tarif ab. */
function embedUrl(): string {
  const params = new URLSearchParams({
    hide_gdpr_banner: "1",
    background_color: "2b2926",
    text_color: "e4e2e7",
    primary_color: "fa7e1e",
    embed_type: "PopupText",
  });
  if (typeof window !== "undefined") {
    params.set("embed_domain", window.location.hostname);
  }
  return `${calendlyUrl}?${params.toString()}`;
}

export function CalendlyProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  // Escape schließt, und der Seiten-Scroll bleibt hinter dem Overlay stehen.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, close]);

  return (
    <CalendlyContext.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="calendly"
            role="dialog"
            aria-modal="true"
            aria-label="Erstgespräch buchen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-[min(92dvh,780px)] w-full max-w-[1000px] flex-col overflow-hidden rounded-3xl border border-snow/15 bg-sky shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-snow/10 px-5 py-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-dune">
                    Erstgespräch
                  </p>
                  <p className="text-sm font-medium text-snow">
                    Boost your Socials, unverbindlich und kostenlos
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Schließen"
                  className="glass flex h-9 w-9 items-center justify-center rounded-full text-snow transition-transform active:scale-90"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <iframe
                src={embedUrl()}
                title="Calendly: Erstgespräch buchen"
                className="h-full w-full flex-1 bg-sky"
                allow="payment"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CalendlyContext.Provider>
  );
}

/** Buchungs-Link, der das Popup öffnet. Fällt ohne Provider oder JS auf
 * den normalen Calendly-Link im neuen Tab zurück. */
export function CalendlyLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(CalendlyContext);
  return (
    <a
      href={calendlyUrl}
      target="_blank"
      rel="noopener noreferrer"
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
