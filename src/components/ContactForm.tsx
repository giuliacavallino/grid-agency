"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
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
      className="w-full rounded-full bg-snow px-7 py-3.5 text-sm font-medium text-sky transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 sm:w-auto"
    >
      {pending ? "Wird gesendet…" : "Nachricht senden"}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <input
          name="company"
          type="text"
          placeholder="Unternehmen / Marke"
          className={inputClasses}
        />
        <select
          name="budget"
          defaultValue=""
          className={`${inputClasses} text-snow/70`}
        >
          <option value="" disabled>
            Monatliches Budget
          </option>
          <option value="<1500" className="bg-sky">
            unter 1.500 €
          </option>
          <option value="1500-3000" className="bg-sky">
            1.500 € – 3.000 €
          </option>
          <option value=">3000" className="bg-sky">
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
    </form>
  );
}
