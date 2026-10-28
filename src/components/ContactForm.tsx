"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";

const initialState: ContactFormState = { status: "idle" };

const inputClasses =
  "w-full rounded-lg border border-snow/15 bg-transparent px-4 py-3 text-sm text-snow placeholder:text-snow/40 outline-none transition-colors focus:border-dune";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="btn-rainbow inline-flex w-full items-center justify-center gap-2 rounded-full bg-snow px-7 py-3.5 text-sm font-medium text-sky disabled:cursor-progress disabled:opacity-80 sm:w-auto"
    >
      {pending && (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
      )}
      {pending ? "Wird gesendet…" : "Nachricht senden"}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);

  return (
    <form action={formAction} className="space-y-3 sm:space-y-4">
      {/* Name und E-Mail haben kurze Platzhalter, die passen auch mobil
          nebeneinander und halten das Formular auf einem Bildschirm. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <input
          name="name"
          type="text"
          required
          placeholder="Name *"
          className={inputClasses}
        />
        <input
          name="email"
          type="email"
          required
          placeholder="E-Mail *"
          className={inputClasses}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <input
          name="company"
          type="text"
          placeholder="Unternehmen / Marke"
          className={inputClasses}
        />
        {/* Solange nichts gewählt ist, sieht der Platzhalter aus wie die
            der Textfelder. */}
        <select
          name="budget"
          defaultValue=""
          className={`${inputClasses} has-[option[value='']:checked]:text-snow/40`}
        >
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
      <textarea
        name="message"
        required
        rows={4}
        placeholder="Erzähl uns von deiner Marke *"
        className={inputClasses}
      />

      <div className="flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center">
        <SubmitButton />
        {state.status !== "idle" && (
          <p
            className={`text-sm ${
              state.status === "success" ? "text-dune" : "text-red-400"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
      <p className="text-[0.6875rem] font-light leading-relaxed text-snow/45">
        Mit dem Absenden verarbeiten wir deine Angaben, um deine Anfrage zu
        beantworten. Mehr dazu in unserer{" "}
        <a href="/datenschutz#kontaktformular" className="underline underline-offset-2 hover:text-snow/70">
          Datenschutzerklärung
        </a>
        .
      </p>
    </form>
  );
}
