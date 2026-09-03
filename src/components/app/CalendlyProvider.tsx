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

/** Calendly als kleines Fenster direkt auf der Seite (unten rechts wie
 * ein Chat-Widget, mobil unten mittig), ohne Abdunkeln oder Blur. Der
 * Kalender lädt erst nach dem Klick (iframe), nicht beim Seitenaufruf. So
 * bleibt der erste Aufruf frei von Calendly-Requests, und ohne JS oder
 * per Mittelklick führt der normale Link weiter auf calendly.com. */

const CalendlyContext = createContext<{ open: () => void } | null>(null);

/** Embed-Parameter: kompakter Kalender ohne Calendly-Kopf, weiß mit
 * Sky-Text und Akzent im Story-Orange. Das Calendly-Branding hängt vom
 * Calendly-Tarif ab. */
function embedUrl(): string {
  const params = new URLSearchParams({
    hide_gdpr_banner: "1",
    // Calendlys eigenen Kopf (Logo, Eventname, Dauer) ausblenden, der
    // Kalender startet direkt bei der Datumsauswahl.
    hide_event_type_details: "1",
    hide_landing_page_details: "1",
    background_color: "ffffff",
    text_color: "2b2926",
    primary_color: "fa7e1e",
    embed_type: "Inline",
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
            className="fixed inset-0 z-[100] flex items-end justify-center p-3 lg:justify-end lg:p-6"
            onClick={close}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-[min(78dvh,580px)] w-full max-w-[370px] flex-col overflow-hidden rounded-2xl border border-snow/20 bg-white shadow-[0_24px_70px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,0,0,0.4)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between bg-sky px-4 py-2.5">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-dune">
                    Erstgespräch · 30 Minuten
                  </p>
                  <p className="text-[13px] font-medium text-snow">
                    Boost your Socials, unverbindlich
                  </p>
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
              <iframe
                src={embedUrl()}
                title="Calendly: Erstgespräch buchen"
                className="h-full w-full flex-1 bg-white"
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
