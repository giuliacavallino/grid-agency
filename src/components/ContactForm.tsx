"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { submitContactForm, type ContactFormState } from "@/app/actions/contact";
import { Altcha } from "@/components/Altcha";

const initialState: ContactFormState = { status: "idle" };

export const inputClasses =
  "w-full rounded-2xl border border-snow/12 bg-snow/[0.04] px-4 py-3 text-sm text-snow placeholder:text-snow/40 outline-none transition-colors focus:border-snow/40 focus:bg-snow/[0.07]";

/** Gleiche Regel wie in der Server-Action: mindestens 6 Ziffern, sonst nur
 * Leerzeichen, +, -, /, Klammern. */
const PHONE_PATTERN = /^\+?[0-9 ()/-]{6,30}$/;

/** Prüft die Felder eines Schritts und zeigt den ersten Fehler an. */
function stepValid(step: HTMLElement | null) {
  const fields = step?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea") ?? [];
  return [...fields].every((field) => {
    if (field.type === "tel") {
      const value = field.value.trim();
      const ok = !value || (PHONE_PATTERN.test(value) && value.replace(/\D/g, "").length >= 6);
      field.setCustomValidity(ok ? "" : "Bitte gib eine gültige Handynummer ein, z. B. +49 170 1234567.");
    }
    return field.reportValidity();
  });
}

/** Nachricht an GRID in zwei Schritten: erst das Anliegen, dann die
 * Kontaktdaten (Name, E-Mail, Handynummer, alle Pflicht). Landet direkt als
 * Lead in Sales → Pipeline. Abgeschickt wird per Transition statt als
 * Formular-Action, damit React die Felder bei einem Fehler nicht leert. */
export function ContactForm() {
  const [state, formAction, pending] = useActionState(submitContactForm, initialState);
  const [step, setStep] = useState<1 | 2>(1);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (step === 1) {
      if (!stepValid(step1Ref.current)) return;
      setStep(2);
      // Nach dem Rendern ins erste Feld von Schritt 2 springen.
      requestAnimationFrame(() => step2Ref.current?.querySelector<HTMLInputElement>("input")?.focus());
      return;
    }
    if (!stepValid(step2Ref.current)) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

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
    <form noValidate onSubmit={onSubmit} className="space-y-3">
      {/* Honeypot: nur Bots füllen das versteckte Feld aus */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <div className="flex items-center gap-3 pb-1">
        <div className="flex flex-1 gap-1.5" aria-hidden>
          <span className="h-1 flex-1 rounded-full bg-snow" />
          <span className={`h-1 flex-1 rounded-full transition-colors ${step === 2 ? "bg-snow" : "bg-snow/15"}`} />
        </div>
        <p className="text-xs font-light text-snow/55" aria-live="polite">
          Schritt {step} von 2
        </p>
      </div>

      {/* Schritt 1: worum es geht */}
      <div ref={step1Ref} hidden={step !== 1} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="company" type="text" placeholder="Marke / Unternehmen" autoComplete="organization" className={inputClasses} />
          {/* Solange nichts gewählt ist, sieht der Platzhalter aus wie die der Textfelder. */}
          <select name="budget" defaultValue="" aria-label="Monatliches Budget" className={`${inputClasses} has-[option[value='']:checked]:text-snow/40`}>
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
        <textarea name="message" required rows={4} placeholder="Erzähl uns von deiner Marke *" aria-label="Erzähl uns von deiner Marke" className={inputClasses} />
        <div className="pt-1">
          <button type="submit" className="btn btn-primary w-full px-7 py-3.5 text-sm sm:w-auto">
            Weiter
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* Schritt 2: Kontaktdaten, alle Pflicht */}
      <div ref={step2Ref} hidden={step !== 2} className="space-y-3">
        <div>
          <p className="text-base font-semibold tracking-tight text-snow">Wie können wir dich erreichen?</p>
          <p className="mt-0.5 text-sm font-light text-snow/60">Damit wir uns schnell bei dir melden können.</p>
        </div>
        <input name="name" type="text" required placeholder="Name *" aria-label="Name" autoComplete="name" className={inputClasses} />
        <input name="email" type="email" required placeholder="E-Mail *" aria-label="E-Mail" autoComplete="email" inputMode="email" className={inputClasses} />
        <input
          name="phone"
          type="tel"
          required
          placeholder="Handynummer *"
          aria-label="Handynummer"
          autoComplete="tel"
          inputMode="tel"
          className={inputClasses}
        />
        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center">
          <button type="button" onClick={() => setStep(1)} disabled={pending} className="btn btn-glass w-full px-6 py-3.5 text-sm sm:w-auto">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
            Zurück
          </button>
          <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary w-full px-7 py-3.5 text-sm sm:w-auto">
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />}
            {pending ? "Wird gesendet…" : "Nachricht senden"}
          </button>
        </div>
      </div>

      <Altcha />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-400">
          {state.message}
        </p>
      )}
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
