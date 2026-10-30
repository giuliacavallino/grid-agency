"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Check, LoaderCircle } from "lucide-react";
import { requestEbook, type EbookFormState } from "@/app/actions/ebook";
import { ContactLink } from "@/components/ui/ContactLink";
import { inputClasses } from "@/components/ContactForm";
import { Altcha } from "@/components/Altcha";
import { trackMetaLead } from "@/lib/metaPixel";

const initialState: EbookFormState = { status: "idle" };

const TRACKING_FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="btn btn-primary w-full px-7 py-3.5 text-sm"
    >
      {pending && (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
      )}
      {pending ? "Wird gesendet…" : "E-Book kostenlos anfordern"}
    </button>
  );
}

/** Anforderung des E-Books: Name, E-Mail, optional Unternehmen. Mit dem
 * Button stimmt die Person Versand und Kontaktaufnahme zu (Text darunter).
 * Kampagnen-Parameter aus der URL (utm_*, fbclid) gehen über versteckte
 * Felder mit, damit der Lead im Intranet als Meta-Lead erkennbar ist. Das
 * PDF kommt per Mail von hello@. */
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
    <>
      {state.status === "success" ? (
        <div className="rise">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-medium tracking-tight text-snow">
            Check dein Postfach.
          </h2>
          <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">
            Dein E-Book ist unterwegs, von hello@grid-agency.de. Nichts
            angekommen? Schau kurz im Spam-Ordner nach. Wenn du den Fahrplan
            nicht allein umsetzen willst, buch dir direkt eine kostenlose
            Erstberatung.
          </p>
          <div className="mt-6">
            <ContactLink tab="termin" className="btn btn-glass px-7 py-3.5 text-sm">
              Erstberatung buchen
            </ContactLink>
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <input name="name" type="text" required autoComplete="name" placeholder="Vor- und Nachname *" className={inputClasses} />
          <input name="email" type="email" required autoComplete="email" placeholder="E-Mail *" className={inputClasses} />
          <input name="company" type="text" autoComplete="organization" placeholder="Unternehmen" className={inputClasses} />

          <Altcha />

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
            Mit dem Klick stimmst du zu, dass wir dir das E-Book per E-Mail
            schicken und dich zu einer kostenlosen Erstberatung kontaktieren.
            Widerruf jederzeit.{" "}
            <a href="/datenschutz#ebook" className="underline underline-offset-2 hover:text-snow/70">
              Datenschutz
            </a>
          </p>
        </form>
      )}
    </>
  );
}
