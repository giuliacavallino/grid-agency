"use client";

import { useEffect, useState } from "react";
import { hasConsent, onConsentChange, revokeConsent } from "@/lib/consent";

/** Datenschutz-Einstellungen auf /datenschutz: zeigt, ob eine gespeicherte
 * Einwilligung für Calendly besteht, und erlaubt den Widerruf mit einem
 * Klick (Art. 7 Abs. 3 DSGVO: so einfach wie die Erteilung). */
export function ConsentSettings() {
  const [calendly, setCalendly] = useState<boolean | null>(null);

  useEffect(() => {
    const sync = () => setCalendly(hasConsent("calendly"));
    sync();
    return onConsentChange(sync);
  }, []);

  return (
    <div className="mt-3 rounded-2xl border border-snow/10 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-snow">Calendly (Terminbuchung)</p>
          <p className="mt-0.5 text-xs font-light text-snow/60">
            {calendly === null
              ? "Status wird geladen …"
              : calendly
                ? "Einwilligung gespeichert: Der Kalender lädt ohne Nachfrage."
                : "Keine Einwilligung gespeichert: Wir fragen vor jedem Laden nach."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => revokeConsent("calendly")}
          disabled={!calendly}
          className="rounded-full border border-snow/20 px-4 py-2 text-xs font-medium text-snow transition-colors hover:bg-snow/10 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
        >
          Einwilligung widerrufen
        </button>
      </div>
    </div>
  );
}
