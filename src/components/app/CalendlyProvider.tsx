"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import { calendlyUrl } from "@/lib/content";
import { grantConsent, hasConsent, onConsentChange } from "@/lib/consent";

/** Calendly als kleines Fenster direkt auf der Seite (unten rechts wie
 * ein Chat-Widget, mobil unten mittig), ohne Abdunkeln oder Blur.
 *
 * Datenschutz: Beim Seitenaufruf gibt es keinerlei Verbindung zu Calendly.
 * Nach dem Klick auf einen Buchungs-Button erscheint zuerst ein Hinweis mit
 * Einwilligung (Zwei-Klick-Lösung). Erst mit "Kalender laden" wird das
 * Calendly-iframe eingebunden. Ohne JS oder per Mittelklick führt der
 * normale Link weiter auf calendly.com. */

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

/** Hinweis vor dem ersten Laden des Kalenders. */
function CalendlyConsent({ onAccept }: { onAccept: (remember: boolean) => void }) {
  const [remember, setRemember] = useState(false);
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 overflow-y-auto p-5 text-sky">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky/5">
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-base font-medium">Kalender von Calendly laden?</p>
        <p className="mt-2 text-[13px] font-light leading-relaxed text-sky/70">
          Für die Terminbuchung nutzen wir Calendly (Calendly LLC, USA). Beim
          Laden des Kalenders werden deine IP-Adresse und deine Eingaben an
          Calendly übertragen, und Calendly kann Cookies setzen. Mehr dazu in
          unserer{" "}
          <Link href="/datenschutz#calendly" className="underline underline-offset-2">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-light text-sky/80">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 accent-[#2b2926]"
        />
        Für künftige Besuche merken
      </label>
      <button
        type="button"
        onClick={() => onAccept(remember)}
        className="rounded-full bg-sky py-3 text-sm font-medium text-snow transition-transform active:scale-[0.98]"
      >
        Kalender laden
      </button>
      <a
        href={calendlyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-center text-[12px] font-light text-sky/60 underline underline-offset-2"
      >
        Stattdessen direkt auf calendly.com buchen
      </a>
    </div>
  );
}

export function CalendlyProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  // Einwilligung nur für diesen Besuch (ohne "merken") oder gespeichert.
  const [consented, setConsented] = useState(false);
  const open = useCallback(() => {
    if (hasConsent("calendly")) setConsented(true);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const accept = useCallback((remember: boolean) => {
    if (remember) grantConsent("calendly");
    setConsented(true);
  }, []);

  // Widerruf über die Datenschutz-Einstellungen greift sofort.
  useEffect(
    () => onConsentChange(() => setConsented(hasConsent("calendly"))),
    [],
  );

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
              {consented ? (
                <iframe
                  src={embedUrl()}
                  title="Calendly: Erstgespräch buchen"
                  className="h-full w-full flex-1 bg-white"
                  allow="payment"
                />
              ) : (
                <CalendlyConsent onAccept={accept} />
              )}
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
