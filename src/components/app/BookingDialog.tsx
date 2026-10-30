"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  LoaderCircle,
  Video,
  X,
} from "lucide-react";
import { bookSlot, getSlots, type BookingRequest, type Slot } from "@/app/actions/booking";
import { inputClasses } from "@/components/ContactForm";
import { BOOKING_EVENT, scrollToId } from "@/lib/scroll";

const TZ = "Europe/Berlin";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekday = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short" });
const dayNum = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "numeric" });
const month = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, month: "short" });
const time = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const long = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

const STEPS = ["Deine Daten", "Termin wählen", "Bestätigung"];
const COUNTRIES = ["Deutschland", "Österreich", "Schweiz", "Anderes Land"];

type Details = Omit<BookingRequest, "start" | "message">;
const emptyDetails: Details = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  street: "",
  number: "",
  zip: "",
  city: "",
  country: "Deutschland",
  website: "",
};

function Field({
  label,
  optional,
  className = "",
  children,
}: {
  label: string;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-snow">
        {label} {optional && <span className="font-light text-snow/50">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

function Stepper({ step, done }: { step: number; done: boolean }) {
  return (
    <ol className="flex gap-3 lg:flex-col lg:gap-0">
      {STEPS.map((label, i) => {
        const complete = done || i < step;
        const active = !done && i === step;
        return (
          <li key={label} className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-0">
            <span className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                  complete
                    ? "border-transparent bg-snow text-sky"
                    : active
                      ? "border-snow text-snow ring-4 ring-snow/10"
                      : "border-snow/20 text-snow/50"
                }`}
              >
                {complete ? <Check className="h-4 w-4" strokeWidth={2.6} /> : i + 1}
              </span>
              <span className={`hidden text-sm lg:inline ${active ? "font-semibold text-snow" : "font-light text-snow/60"}`}>{label}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className="hidden h-6 w-px translate-x-[1.1rem] bg-snow/15 lg:block" />}
          </li>
        );
      })}
    </ol>
  );
}

/** Erstgespräch buchen als Popup in drei Schritten: Daten, Termin,
 * Bestätigung. Freie Zeiten kommen aus Giulias Kalender, gebucht wird bei
 * hello@ mit Teams-Link, die Anfrage landet als Lead in der Pipeline.
 * Öffnet sich auf jeder Seite über `openBooking()`. */
export function BookingDialog() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [message, setMessage] = useState("");
  const [slots, setSlots] = useState<Slot[] | null | undefined>(undefined);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Slot | null>(null);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  const loadSlots = useCallback(() => {
    setSlots(undefined);
    getSlots().then(setSlots);
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      // Freie Zeiten schon laden, während die Daten eingetragen werden
      loadSlots();
    };
    window.addEventListener(BOOKING_EVENT, onOpen);
    return () => window.removeEventListener(BOOKING_EVENT, onOpen);
  }, [loadSlots]);

  const close = useCallback(() => {
    setOpen(false);
    // Nach erfolgreicher Buchung beim nächsten Öffnen frisch starten
    if (booked) {
      setBooked(null);
      setStep(0);
      setDetails(emptyDetails);
      setMessage("");
      setPicked(null);
      setDay(null);
    }
  }, [booked]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("input, button[data-autofocus]")?.focus());
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Beim Schrittwechsel nach oben, falls der Inhalt gescrollt war
  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
  }, [step, booked]);

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots ?? []) {
      const key = dayKey.format(new Date(slot.start));
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return [...map.entries()];
  }, [slots]);
  const activeDay = day ?? days[0]?.[0] ?? null;
  const daySlots = days.find(([key]) => key === activeDay)?.[1] ?? [];

  const set = (key: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDetails((d) => ({ ...d, [key]: e.target.value }));

  const submit = () => {
    if (!picked) return;
    setError(null);
    startTransition(async () => {
      const result = await bookSlot({ ...details, start: picked.start, message });
      if (result.ok) {
        setBooked(result.slot);
        return;
      }
      setError(result.message);
      if (result.taken) {
        // Die Zeit war weg: zurück zur Auswahl mit frischen Zeiten
        setPicked(null);
        setStep(1);
        loadSlots();
      }
    });
  };

  const writeInstead = () => {
    close();
    scrollToId("dm");
  };

  if (!mounted || !open) return null;

  const company = details.company;
  const address = [
    [details.street, details.number].filter(Boolean).join(" "),
    [details.zip, details.city].filter(Boolean).join(" "),
    details.country,
  ]
    .filter(Boolean)
    .join(", ");

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-sky/60 backdrop-blur-xl [animation:rise_0.3s_ease_backwards] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        // Feste Höhe für alle drei Schritte, damit das Popup beim Wechsel nicht
        // springt; wird es zu eng, scrollt nur der Inhalt rechts
        className="glass relative flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[2rem] bg-sky/70 [animation:rise_0.45s_var(--ease-spring)_backwards] sm:h-[min(50rem,92dvh)] sm:rounded-[2rem] lg:grid lg:h-[min(46rem,90dvh)] lg:grid-cols-[17rem_minmax(0,1fr)]"
      >
        <button
          type="button"
          aria-label="Schließen"
          onClick={close}
          className="btn-glass absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-snow active:scale-90 lg:right-6 lg:top-6"
        >
          <X className="h-5 w-5" strokeWidth={1.8} />
        </button>

        {/* Seitenleiste: worum es geht und wo man steht */}
        <aside className="shrink-0 border-b border-snow/10 p-6 pr-20 lg:border-b-0 lg:border-r lg:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-snow/50">GRID Agency</p>
          <h2 id="booking-title" className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-snow">
            Erstgespräch
          </h2>
          <ul className="mt-5 hidden space-y-3 text-sm font-light text-snow/80 lg:block">
            <li className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-snow/60" strokeWidth={1.8} />
              30 Minuten
            </li>
            <li className="flex items-center gap-3">
              <Video className="h-4 w-4 text-snow/60" strokeWidth={1.8} />
              Online per Teams
            </li>
            <li className="flex items-center gap-3">
              <BadgeCheck className="h-4 w-4 text-snow/60" strokeWidth={1.8} />
              Kostenlos und unverbindlich
            </li>
          </ul>
          <p className="mt-1 text-sm font-light text-snow/60 lg:hidden">30 Min · per Teams · kostenlos</p>
          <div className="mt-5 lg:mt-7 lg:border-t lg:border-snow/10 lg:pt-7">
            <Stepper step={step} done={Boolean(booked)} />
          </div>
        </aside>

        <div ref={content} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-6 lg:p-10">
          {booked ? (
            <div role="status" className="flex h-full flex-col items-start justify-center gap-5 [animation:rise_0.5s_var(--ease-spring)_backwards]">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-snow text-sky">
                <CalendarCheck className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-3xl font-semibold tracking-[-0.03em] text-snow">Du bist im Kalender. 🎉</h3>
                <p className="mt-3 max-w-md text-base font-light leading-relaxed text-snow/70">
                  {long.format(new Date(booked.start))} um {time.format(new Date(booked.start))} Uhr. Die Einladung mit
                  Teams-Link kommt gleich per Mail von hello@grid-agency.de an {details.email}. Giulia freut sich auf dich.
                </p>
              </div>
              <button type="button" onClick={close} className="btn btn-primary mt-2 px-7 py-3.5 text-sm" data-autofocus>
                Fertig
              </button>
            </div>
          ) : step === 0 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(1);
              }}
            >
              <h3 className="text-3xl font-semibold tracking-[-0.03em] text-snow">Wer bist du?</h3>
              <p className="mt-2 text-base font-light text-snow/65">Damit wir uns gut vorbereiten können.</p>

              {/* Honeypot */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={details.website} onChange={set("website")} />

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-snow/50">Ansprechpartner</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Vorname">
                  <input required autoComplete="given-name" value={details.firstName} onChange={set("firstName")} className={inputClasses} />
                </Field>
                <Field label="Nachname">
                  <input required autoComplete="family-name" value={details.lastName} onChange={set("lastName")} className={inputClasses} />
                </Field>
                <Field label="E-Mail">
                  <input required type="email" autoComplete="email" value={details.email} onChange={set("email")} className={inputClasses} />
                </Field>
                <Field label="Telefon" optional>
                  <input type="tel" autoComplete="tel" value={details.phone} onChange={set("phone")} className={inputClasses} />
                </Field>
              </div>

              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-snow/50">Firma</p>
              <div className="mt-4 grid grid-cols-6 gap-4">
                <Field label="Firmenname inkl. Rechtsform" className="col-span-6 sm:col-span-3">
                  <input required autoComplete="organization" placeholder="Muster GmbH" value={details.company} onChange={set("company")} className={inputClasses} />
                </Field>
                <Field label="Straße" className="col-span-4 sm:col-span-2">
                  <input required autoComplete="address-line1" value={details.street} onChange={set("street")} className={inputClasses} />
                </Field>
                <Field label="Nr." className="col-span-2 sm:col-span-1">
                  <input required value={details.number} onChange={set("number")} className={inputClasses} />
                </Field>
                <Field label="PLZ" className="col-span-2 sm:col-span-1">
                  <input required autoComplete="postal-code" inputMode="numeric" value={details.zip} onChange={set("zip")} className={inputClasses} />
                </Field>
                <Field label="Ort" className="col-span-4 sm:col-span-3">
                  <input required autoComplete="address-level2" value={details.city} onChange={set("city")} className={inputClasses} />
                </Field>
                <Field label="Land" className="col-span-6 sm:col-span-2">
                  <select value={details.country} onChange={set("country")} className={inputClasses}>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} className="bg-sky text-snow">
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <button type="submit" className="btn btn-primary mt-8 py-2 pl-6 pr-2 text-[0.9375rem]">
                Weiter
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky text-snow">
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                </span>
              </button>
            </form>
          ) : step === 1 ? (
            <div>
              <h3 className="text-3xl font-semibold tracking-[-0.03em] text-snow">Wann passt&apos;s dir?</h3>
              <p className="mt-2 text-base font-light text-snow/65">Alle Zeiten in deutscher Zeit, 30 Minuten per Teams.</p>
              {error && <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

              {slots === undefined && (
                <div aria-busy className="mt-8 space-y-3">
                  <div className="flex gap-2">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="skeleton h-[4.5rem] w-16 rounded-2xl" />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="skeleton h-11 rounded-full" />
                    ))}
                  </div>
                  <span className="sr-only">Freie Termine werden geladen …</span>
                </div>
              )}

              {(slots === null || (slots && slots.length === 0)) && (
                <div className="mt-8 rounded-2xl border border-snow/10 p-5 text-sm font-light text-snow/70">
                  {slots === null ? "Der Kalender ist gerade nicht erreichbar." : "In den nächsten Wochen ist leider alles voll."}{" "}
                  <button type="button" onClick={writeInstead} className="font-medium text-snow underline underline-offset-4">
                    Schreib uns stattdessen eine Nachricht
                  </button>
                </div>
              )}

              {slots && slots.length > 0 && (
                <>
                  <div role="listbox" aria-label="Tag wählen" className="no-scrollbar -mx-1 mt-8 flex gap-2 overflow-x-auto px-1 pb-1">
                    {days.map(([key, list]) => {
                      const date = new Date(list[0].start);
                      const active = key === activeDay;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setDay(key);
                            setPicked(null);
                          }}
                          className={`flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition-colors ${
                            active ? "border-snow bg-snow text-sky" : "border-snow/12 bg-snow/[0.04] text-snow hover:bg-snow/10"
                          }`}
                        >
                          <span className="text-[0.6875rem] font-medium uppercase opacity-70">{weekday.format(date)}</span>
                          <span className="text-xl font-semibold leading-tight">{dayNum.format(date)}</span>
                          <span className="text-[0.625rem] font-light opacity-70">{month.format(date)}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div role="listbox" aria-label="Uhrzeit wählen" className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {daySlots.map((slot) => {
                      const active = picked?.start === slot.start;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => setPicked(slot)}
                          className={`rounded-full border py-3 text-sm font-medium tabular-nums transition-colors ${
                            active ? "border-transparent bg-snow text-sky" : "border-snow/12 text-snow hover:bg-snow/10"
                          }`}
                        >
                          {time.format(new Date(slot.start))}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setStep(0)} className="btn btn-glass px-5 py-3.5 text-sm">
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Zurück
                </button>
                <button
                  type="button"
                  disabled={!picked}
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="btn btn-primary py-2 pl-6 pr-2 text-[0.9375rem] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Weiter
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky text-snow">
                    <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-3xl font-semibold tracking-[-0.03em] text-snow">Passt alles?</h3>
              <p className="mt-2 text-base font-light text-snow/65">Kurz checken, dann bist du im Kalender.</p>

              <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-snow/[0.06] p-5 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-snow/50">Termin</dt>
                  <dd className="mt-1.5 text-lg font-semibold text-snow">
                    {picked && `${long.format(new Date(picked.start))}, ${time.format(new Date(picked.start))} Uhr`}
                  </dd>
                  <dd className="text-sm font-light text-snow/60">30 Minuten mit Giulia per Teams</dd>
                </div>
                <div className="rounded-2xl bg-snow/[0.06] p-5">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-snow/50">Ansprechpartner</dt>
                  <dd className="mt-1.5 text-sm font-medium text-snow">
                    {details.firstName} {details.lastName}
                  </dd>
                  <dd className="text-sm font-light text-snow/60">{details.email}</dd>
                  {details.phone && <dd className="text-sm font-light text-snow/60">{details.phone}</dd>}
                </div>
                <div className="rounded-2xl bg-snow/[0.06] p-5">
                  <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-snow/50">Firma</dt>
                  <dd className="mt-1.5 text-sm font-medium text-snow">{company}</dd>
                  <dd className="text-sm font-light text-snow/60">{address}</dd>
                </div>
              </dl>

              <label className="mt-5 block">
                <span className="mb-1.5 block text-sm font-medium text-snow">
                  Worum geht&apos;s? <span className="font-light text-snow/50">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Kanäle, Ziele, was gerade nicht läuft …"
                  className={inputClasses}
                />
              </label>

              {error && <p className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setStep(1)} disabled={pending} className="btn btn-glass px-5 py-3.5 text-sm">
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Zurück
                </button>
                <button type="button" onClick={submit} disabled={pending} aria-busy={pending} className="btn btn-primary px-7 py-3.5 text-[0.9375rem]" data-autofocus>
                  {pending && <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />}
                  {pending ? "Wird gebucht…" : "Termin verbindlich buchen"}
                </button>
              </div>
              <p className="mt-4 text-[0.6875rem] font-light leading-relaxed text-snow/45">
                Wir legen den Termin in unserem Microsoft-365-Kalender an und schicken dir die Einladung. Mehr in der{" "}
                <a href="/datenschutz#termine" className="underline underline-offset-2 hover:text-snow/70">
                  Datenschutzerklärung
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
