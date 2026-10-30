"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, LoaderCircle, Paperclip } from "lucide-react";
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
import { SearchedChip } from "@/components/SearchedChip";
import { inputClasses } from "@/components/ContactForm";

const initialState: ApplicationFormState = { status: "idle" };

const INITIATIVE = "initiativ";


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
      className="btn btn-primary w-full px-7 py-3.5 text-sm sm:w-auto"
    >
      {pending && (
        <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />
      )}
      {pending ? "Wird gesendet…" : "Bewerbung absenden"}
    </button>
  );
}

type JobOption = { value: string; label: string; searched: boolean };

/** Stellenauswahl im Look der Seite statt des nativen Dropdowns, damit
 * gesuchte Stellen den grünen Chip zeigen. Bedienbar wie ein Select:
 * Pfeiltasten, Enter, Escape, Tippen auf eine Option. Der Wert geht über
 * ein verstecktes Feld ins Formular. */
function JobSelect({
  options,
  value,
  onChange,
  invalid,
  buttonRef,
}: {
  options: JobOption[];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    requestAnimationFrame(() => list.current?.focus());
  };

  const choose = (option: JobOption) => {
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (event.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") choose(options[active]);
    else if (event.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "Tab") setOpen(false);
    else return;
    if (event.key !== "Tab") event.preventDefault();
  };

  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  return (
    <div ref={root} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            show();
          }
        }}
        className={`${inputClasses} flex items-center justify-between gap-3 text-left ${
          invalid ? "border-red-400/70" : ""
        } ${open ? "border-dune" : ""}`}
      >
        {selected ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <span>{selected.label}</span>
            {selected.searched && <SearchedChip />}
          </span>
        ) : (
          <span className="text-snow/40">Auf welche Stelle bewirbst du dich? *</span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-snow/50 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open && (
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label="Stelle"
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={onListKey}
            className="[animation:rise_0.2s_var(--ease-spring)_backwards] glass-dark absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl p-1.5 shadow-2xl outline-none"
          >
            {options.map((option, i) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    i === active ? "bg-snow/10" : ""
                  } ${isSelected ? "text-snow" : "text-snow/80"}`}
                >
                  <Check
                    className={`h-4 w-4 shrink-0 text-dune ${isSelected ? "" : "invisible"}`}
                    strokeWidth={2.25}
                  />
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span>{option.label}</span>
                    {option.searched && <SearchedChip />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

/** Grüner Haken nach dem Absenden: Kreis und Haken zeichnen sich nach,
 * dazu ein kurzer Puls. */
function SuccessCheck() {
  return (
    <div className="relative h-16 w-16 [animation:pop-in_0.5s_var(--ease-spring)_backwards]">
      <span aria-hidden className="absolute inset-0 rounded-full bg-emerald-400/25 [animation:pulse-out_0.9s_0.55s_ease-out_both]" />
      <svg viewBox="0 0 64 64" className="relative h-16 w-16" aria-hidden>
        <g transform="rotate(-90 32 32)">
          <circle
            cx="32"
            cy="32"
            r="29"
            fill="rgb(52 211 153 / 0.12)"
            stroke="rgb(52 211 153)"
            strokeWidth="3"
            pathLength={1}
            className="[stroke-dasharray:1] [animation:draw_0.5s_ease-in-out_both]"
          />
        </g>
        <path
          d="M20 33 l8 8 l16 -18"
          fill="none"
          stroke="rgb(52 211 153)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="[stroke-dasharray:1] [animation:draw_0.35s_0.4s_ease-out_both]"
        />
      </svg>
    </div>
  );
}

/** Bewerbungsformular auf /jobs: Angaben und Unterlagen gehen direkt als
 * Karte in Personal → Bewerbungen im Intranet. */
export function ApplicationForm({
  jobs,
  searched,
  job,
  onJobChange,
}: {
  jobs: Job[];
  searched: string[];
  job: string;
  onJobChange: (slug: string) => void;
}) {
  const [state, formAction, pending] = useActionState(submitApplication, initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [jobMissing, setJobMissing] = useState(false);
  const jobButton = useRef<HTMLButtonElement>(null);

  const options: JobOption[] = [
    ...jobs.map((j) => ({ value: j.slug, label: j.title, searched: searched.includes(j.slug) })),
    { value: INITIATIVE, label: "Initiativbewerbung", searched: false },
  ];

  // Absenden ohne <form action>: React würde das Formular danach leeren,
  // auch bei einem Fehler, und Angaben samt Dateien wären weg.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Die eigene Stellenauswahl hat keine Browser-Pflichtfeldprüfung
    if (!job) {
      setJobMissing(true);
      jobButton.current?.focus();
      return;
    }
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
        <SuccessCheck />
        <p
          style={{ "--d": "600ms" } as React.CSSProperties}
          className="rise max-w-md text-sm font-light leading-relaxed text-snow/80"
        >
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

      <input type="hidden" name="job" value={job} />
      <div>
        <JobSelect
          options={options}
          value={job}
          onChange={(value) => {
            setJobMissing(false);
            onJobChange(value);
          }}
          invalid={jobMissing}
          buttonRef={jobButton}
        />
        {jobMissing && (
          <p className="mt-2 text-xs text-red-400">Bitte wähl eine Stelle oder „Initiativbewerbung“.</p>
        )}
      </div>

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
          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors focus-within:border-dune hover:border-snow/35 ${
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
