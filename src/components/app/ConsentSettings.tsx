"use client";

import { useEffect, useState } from "react";
import {
  consentState,
  hasConsent,
  onConsentChange,
  revokeConsent,
} from "@/lib/consent";
import { clearMetaCookies, metaPixelEnabled } from "@/lib/metaPixel";

function ConsentRow({
  title,
  status,
  canRevoke,
  onRevoke,
}: {
  title: string;
  status: string;
  canRevoke: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium text-snow">{title}</p>
        <p className="mt-0.5 text-xs font-light text-snow/60">{status}</p>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={!canRevoke}
        className="rounded-full border border-snow/20 px-4 py-2 text-xs font-medium text-snow transition-colors hover:bg-snow/10 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Einwilligung widerrufen
      </button>
    </div>
  );
}

/** Datenschutz-Einstellungen auf /datenschutz: zeigt, ob eine gespeicherte
 * Einwilligung für Calendly oder das Meta-Pixel besteht, und erlaubt den
 * Widerruf mit einem Klick (Art. 7 Abs. 3 DSGVO: so einfach wie die
 * Erteilung). */
export function ConsentSettings() {
  const [calendly, setCalendly] = useState<boolean | null>(null);
  const [meta, setMeta] = useState<"granted" | "denied" | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => {
      setCalendly(hasConsent("calendly"));
      setMeta(consentState("meta"));
    };
    sync();
    return onConsentChange(sync);
  }, []);

  return (
    <div className="mt-3 divide-y divide-snow/10 rounded-2xl border border-snow/10 p-5">
      <ConsentRow
        title="Calendly (Terminbuchung)"
        status={
          calendly === null
            ? "Status wird geladen …"
            : calendly
              ? "Einwilligung gespeichert: Der Kalender lädt ohne Nachfrage."
              : "Keine Einwilligung gespeichert: Wir fragen vor jedem Laden nach."
        }
        canRevoke={Boolean(calendly)}
        onRevoke={() => revokeConsent("calendly")}
      />
      {metaPixelEnabled && (
        <ConsentRow
          title="Meta-Pixel (E-Book-Seite)"
          status={
            meta === undefined
              ? "Status wird geladen …"
              : meta === "granted"
                ? "Einwilligung erteilt: Das Pixel lädt auf der E-Book-Seite."
                : "Keine Einwilligung: Das Pixel wird nicht geladen."
          }
          canRevoke={meta === "granted"}
          onRevoke={() => {
            revokeConsent("meta");
            clearMetaCookies();
          }}
        />
      )}
    </div>
  );
}
