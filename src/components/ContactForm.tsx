"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { Altcha } from "@/components/Altcha";

const initialState: ContactFormState = { status: "idle" };

export const inputClasses =
  "w-full rounded-2xl border border-snow/12 bg-snow/[0.04] px-4 py-3 text-sm text-snow placeholder:text-snow/40 outline-none transition-colors focus:border-snow/40 focus:bg-snow/[0.07]";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary w-full px-7 py-3.5 text-sm sm:w-auto">
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />}
      {pending ? "Wird gesendet…" : "Nachricht senden"}
    </button>
  );
}

/** Nachricht an GRID: landet direkt als Lead in Sales → Pipeline. */
export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-snow text-sky">
          <CheckCircle2 className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-xl font-semibold tracking-tight text-snow">Angekommen. ✌️</p>
          <p className="mt-2 max-w-md text-sm font-light leading-relaxed text-snow/70">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {/* Honeypot: nur Bots füllen das versteckte Feld aus */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="grid grid-cols-2 gap-3">
        <input name="name" type="text" required placeholder="Name *" autoComplete="name" className={inputClasses} />
        <input name="email" type="email" required placeholder="E-Mail *" autoComplete="email" className={inputClasses} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="company" type="text" placeholder="Marke / Unternehmen" autoComplete="organization" className={inputClasses} />
        {/* Solange nichts gewählt ist, sieht der Platzhalter aus wie die der Textfelder. */}
        <select name="budget" defaultValue="" className={`${inputClasses} has-[option[value='']:checked]:text-snow/40`}>
          <option value="" disabled>
            Monatliches Budget
          </option>
          <option value="<1500" className="bg-sky text-snow">
            unter 1.500 €
          </option>
          <option value="1500-3000" className="bg-sky text-snow">
            1.500 € – 3.000 €
          </option>
          <option value=">3000" className="bg-sky text-snow">
            über 3.000 €
          </option>
        </select>
      </div>
      <textarea name="message" required rows={4} placeholder="Erzähl uns von deiner Marke *" className={inputClasses} />
      <Altcha />

      <div className="flex flex-col items-start gap-3 pt-1 sm:flex-row sm:items-center">
        <SubmitButton />
        {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
      </div>
      <p className="text-[0.6875rem] font-light leading-relaxed text-snow/45">
        Mit dem Absenden verarbeiten wir deine Angaben, um deine Anfrage zu beantworten. Mehr dazu in unserer{" "}
        <a href="/datenschutz#kontaktformular" className="underline underline-offset-2 hover:text-snow/70">
          Datenschutzerklärung
        </a>
        .
      </p>
    </form>
  );
}
