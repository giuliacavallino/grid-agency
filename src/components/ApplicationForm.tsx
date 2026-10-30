"use client";

import { startTransition, useActionState, useState } from "react";
import { CircleCheck, LoaderCircle, Paperclip } from "lucide-react";
import {
  submitApplication,
  type ApplicationFormState,
} from "@/app/actions/application";
import type { Job } from "@/lib/content";
import {
  APPLICATION_ACCEPT,
  APPLICATION_MAX_BYTES,
  APPLICATION_MAX_FILES,
} from "@/lib/application";

const initialState: ApplicationFormState = { status: "idle" };

export const INITIATIVE = "initiativ";

const inputClasses =
  "w-full rounded-lg border border-snow/15 bg-transparent px-4 py-3 text-sm text-snow placeholder:text-snow/40 outline-none transition-colors focus:border-dune";

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;

function SubmitButton({ pending }: { pending: boolean }) {
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
      {pending ? "Wird gesendet…" : "Bewerbung absenden"}
    </button>
  );
}

/** Bewerbungsformular auf /jobs: Angaben und Unterlagen gehen direkt als
 * Karte in Personal → Bewerbungen im Intranet. */
export function ApplicationForm({
  jobs,
  job,
  onJobChange,
}: {
  jobs: Job[];
  job: string;
  onJobChange: (slug: string) => void;
}) {
  const [state, formAction, pending] = useActionState(submitApplication, initialState);
  const [files, setFiles] = useState<File[]>([]);

  // Absenden ohne <form action>: React würde das Formular danach leeren,
  // auch bei einem Fehler, und Angaben samt Dateien wären weg.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  const total = files.reduce((sum, f) => sum + f.size, 0);
  const fileError =
    files.length > APPLICATION_MAX_FILES
      ? `Bitte höchstens ${APPLICATION_MAX_FILES} Dateien.`
      : total > APPLICATION_MAX_BYTES
        ? `Zusammen ${formatSize(total)}, erlaubt sind 4 MB.`
        : "";

  const onFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    setFiles(list);
    const tooMany = list.length > APPLICATION_MAX_FILES;
    const tooBig = list.reduce((sum, f) => sum + f.size, 0) > APPLICATION_MAX_BYTES;
    // Blockiert das Absenden schon im Browser, statt erst am Server
    event.target.setCustomValidity(
      tooMany || tooBig ? "Bitte wähle kleinere oder weniger Dateien." : ""
    );
  };

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-snow/10 bg-snow/[0.04] px-6 py-10 text-center">
        <CircleCheck className="h-8 w-8 text-dune" strokeWidth={1.75} />
        <p className="max-w-md text-sm font-light leading-relaxed text-snow/80">
          {state.message ?? "Danke für deine Bewerbung!"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 sm:space-y-4">
      {/* Honeypot gegen Spam-Bots, für Menschen unsichtbar */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <select
        name="job"
        required
        value={job}
        onChange={(e) => onJobChange(e.target.value)}
        aria-label="Stelle"
        className={`${inputClasses} has-[option[value='']:checked]:text-snow/40`}
      >
        <option value="" disabled>
          Auf welche Stelle bewirbst du dich? *
        </option>
        {jobs.map((j) => (
          <option key={j.slug} value={j.slug} className="bg-sky text-snow">
            {j.title}
          </option>
        ))}
        <option value={INITIATIVE} className="bg-sky text-snow">
          Initiativbewerbung
        </option>
      </select>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <input
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="name"
          placeholder="Vor- und Nachname *"
          className={inputClasses}
        />
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          placeholder="E-Mail *"
          className={inputClasses}
        />
        <input
          name="phone"
          type="tel"
          maxLength={60}
          autoComplete="tel"
          placeholder="Telefon"
          className={inputClasses}
        />
        <input
          name="link"
          type="text"
          maxLength={500}
          inputMode="url"
          placeholder="Portfolio, Instagram oder LinkedIn"
          className={inputClasses}
        />
      </div>

      <textarea
        name="message"
        rows={4}
        maxLength={5000}
        placeholder="Erzähl uns kurz von dir und warum du zu GRID passt"
        className={inputClasses}
      />

      <div>
        <label
          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-within:border-dune hover:border-snow/35 ${
            fileError ? "border-red-400/70" : "border-snow/20"
          }`}
        >
          <Paperclip className="h-5 w-5 text-snow/50" strokeWidth={1.75} />
          <span className="text-sm text-snow">
            {files.length ? "Andere Dateien wählen" : "Lebenslauf & Unterlagen hochladen *"}
          </span>
          <span className="text-xs font-light text-snow/45">
            PDF, JPG, PNG oder Word · bis zu {APPLICATION_MAX_FILES} Dateien, zusammen max. 4 MB
          </span>
          <input
            name="files"
            type="file"
            multiple
            required
            accept={APPLICATION_ACCEPT}
            onChange={onFiles}
            className="sr-only"
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f) => (
              <li
                key={`${f.name}-${f.size}`}
                className="flex items-center justify-between gap-3 text-xs font-light text-snow/65"
              >
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-snow/45">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
        )}
        {fileError && <p className="mt-2 text-xs text-red-400">{fileError}</p>}
      </div>

      <div className="flex flex-col items-start gap-4 pt-2 sm:flex-row sm:items-center">
        <SubmitButton pending={pending} />
        {state.status === "error" && (
          <p className="text-sm text-red-400">{state.message}</p>
        )}
      </div>
      <p className="text-[0.6875rem] font-light leading-relaxed text-snow/45">
        Mit dem Absenden verarbeiten wir deine Angaben und Unterlagen für das
        Bewerbungsverfahren. Mehr dazu in unserer{" "}
        <a href="/datenschutz#bewerbungen" className="underline underline-offset-2 hover:text-snow/70">
          Datenschutzerklärung
        </a>
        .
      </p>
    </form>
  );
}
