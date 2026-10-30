"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  consentState,
  denyConsent,
  grantConsent,
  onConsentChange,
} from "@/lib/consent";
import { loadMetaPixel, metaPixelEnabled } from "@/lib/metaPixel";

/** Einwilligung für das Meta-Pixel auf der E-Book-Seite: kleines Banner,
 * Erlauben und Ablehnen gleichwertig. Erst nach „Erlauben“ wird das
 * Skript von Meta geladen; die Entscheidung bleibt im localStorage und ist
 * unter /datenschutz#einstellungen widerrufbar. */
export function MetaPixelConsent() {
  const [state, setState] = useState<"granted" | "denied" | null | undefined>(undefined);

  useEffect(() => {
    if (!metaPixelEnabled) return;
    const sync = () => setState(consentState("meta"));
    sync();
    return onConsentChange(sync);
  }, []);

  useEffect(() => {
    if (state === "granted") loadMetaPixel();
  }, [state]);

  return (
    <AnimatePresence>
      {state === null && (
        <motion.div
          role="dialog"
          aria-label="Einwilligung für das Meta-Pixel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-50 mx-auto max-w-md rounded-2xl border border-snow/15 bg-sky/95 p-5 shadow-2xl shadow-black/40 backdrop-blur lg:inset-x-auto lg:bottom-6 lg:left-6"
        >
          <p className="text-sm font-medium text-snow">Dürfen wir messen?</p>
          <p className="mt-1.5 text-xs font-light leading-relaxed text-snow/65">
            Mit deiner Einwilligung laden wir auf dieser Seite das Meta-Pixel.
            So sehen wir, ob unsere Anzeigen funktionieren. Dabei werden Daten
            an Meta übertragen, auch in die USA. Mehr in der{" "}
            <Link href="/datenschutz#meta-pixel" className="underline underline-offset-2 hover:text-snow">
              Datenschutzerklärung
            </Link>
            .
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => denyConsent("meta")}
              className="rounded-full border border-snow/20 px-4 py-2.5 text-xs font-medium text-snow transition-colors hover:bg-snow/10"
            >
              Ablehnen
            </button>
            <button
              type="button"
              onClick={() => grantConsent("meta")}
              className="rounded-full border border-snow bg-snow px-4 py-2.5 text-xs font-medium text-sky transition-opacity hover:opacity-90"
            >
              Erlauben
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
