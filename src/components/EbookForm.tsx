"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Check, LoaderCircle } from "lucide-react";
import { requestEbook, type EbookFormState } from "@/app/actions/ebook";
import { CalendlyLink } from "@/components/app/CalendlyProvider";
import { trackMetaLead } from "@/lib/metaPixel";

const initialState: EbookFormState = { status: "idle" };

export const EBOOK_PDF = "/ebook/social-media-2027.pdf";

const TRACKING_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
];

const inputClasses =
  "w-full rounded-lg border border-snow/15 bg-transparent px-4 py-3 text-sm text-snow placeholder:text-snow/40 outline-none transition-colors focus:border-dune";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="btn-rainbow inline-flex w-full items-center justify-center gap-2 rounded-full bg-snow px-7 py-3.5 text-sm font-medium text-sky disabled:cursor-progress disabled:opacity-80"
    >
      {pending && (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
      )}
      {pending ? "Wird angefordert…" : "E-Book kostenlos herunterladen"}
    </button>
  );
}

/** Anforderung des E-Books: Name, E-Mail, optional Unternehmen und die
 * Einwilligung zur Kontaktaufnahme. Kampagnen-Parameter aus der URL
 * (utm_*, fbclid) gehen über versteckte Felder mit, damit der Lead im
 * Intranet als Meta-Lead erkennbar ist. Danach gibt es den Download. */
export function EbookForm() {
  const [state, formAction] = useActionState(requestEbook, initialState);
  const trackingRef = useRef<HTMLDivElement>(null);

  // Werte direkt in die versteckten Felder schreiben, ohne Re-Render
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    trackingRef.current
      ?.querySelectorAll<HTMLInputElement>("input")
      .forEach((input) => {
        input.value = params.get(input.name) ?? "";
      });
  }, []);

  // Conversion für die Meta-Anzeigen, nur mit Einwilligung (siehe metaPixel.ts)
  useEffect(() => {
    if (state.status === "success") trackMetaLead();
  }, [state]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state.status === "success" ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-medium tracking-tight text-snow">
            Dein E-Book ist bereit.
          </h2>
          <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
            Viel Spaß beim Lesen. Wenn du den Fahrplan nicht allein umsetzen
            willst, buch dir direkt eine kostenlose Erstberatung.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={EBOOK_PDF}
              download
              className="btn-rainbow inline-flex items-center justify-center gap-2 rounded-full bg-snow px-7 py-3.5 text-sm font-medium text-sky"
            >
              <ArrowDown className="h-4 w-4" strokeWidth={2} aria-hidden />
              PDF herunterladen
            </a>
            <CalendlyLink className="inline-flex items-center justify-center rounded-full border border-snow/20 px-7 py-3.5 text-sm font-medium text-snow transition-colors hover:border-snow/50">
              Erstberatung buchen
            </CalendlyLink>
          </div>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          action={formAction}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="space-y-3"
        >
          <input name="name" type="text" required autoComplete="name" placeholder="Vor- und Nachname *" className={inputClasses} />
          <input name="email" type="email" required autoComplete="email" placeholder="E-Mail *" className={inputClasses} />
          <input name="company" type="text" autoComplete="organization" placeholder="Unternehmen" className={inputClasses} />

          <label className="flex cursor-pointer gap-3 pt-1 text-[0.75rem] font-light leading-relaxed text-snow/60">
            <input
              name="consent"
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#fa7e1e]"
            />
            <span>
              Ja, schickt mir das E-Book. GRID darf mich per E-Mail oder
              Telefon zu Social Media und einer kostenlosen Erstberatung
              kontaktieren. Die Einwilligung kann ich jederzeit widerrufen. *
            </span>
          </label>

          {/* Honeypot gegen Bots */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />
          <div ref={trackingRef} hidden>
            {TRACKING_FIELDS.map((field) => (
              <input key={field} type="hidden" name={field} />
            ))}
          </div>

          <div className="pt-2">
            <SubmitButton />
          </div>
          {state.status === "error" && (
            <p className="text-sm text-red-400">{state.message}</p>
          )}
          <p className="text-[0.6875rem] font-light leading-relaxed text-snow/45">
            Mehr zur Verarbeitung deiner Daten in unserer{" "}
            <a href="/datenschutz#ebook" className="underline underline-offset-2 hover:text-snow/70">
              Datenschutzerklärung
            </a>
            .
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
