"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarCheck, LoaderCircle, Video } from "lucide-react";
import { bookSlot, getSlots, type BookingState, type Slot } from "@/app/actions/booking";
import { inputClasses } from "@/components/ContactForm";

const TZ = "Europe/Berlin";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekday = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short" });
const dayNum = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "numeric" });
const month = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, month: "short" });
const time = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const long = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary w-full px-7 py-3.5 text-sm sm:w-auto">
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />}
      {pending ? "Wird gebucht…" : "Termin verbindlich buchen"}
    </button>
  );
}

/** Erstgespräch buchen, direkt in Giulias Kalender: Tag und Uhrzeit wählen,
 * Kontaktdaten eintragen, Einladung mit Teams-Link kommt per Mail. Freie
 * Zeiten werden erst geladen, wenn der Kalender ins Bild kommt. */
export function BookingWidget({ onUnavailable }: { onUnavailable?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Slot[] | null | undefined>(undefined);
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [state, action] = useActionState<BookingState, FormData>(bookSlot, { status: "idle" });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        getSlots().then(setSlots);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Die Zeit war weg: neu laden, damit sie nicht mehr angeboten wird
  useEffect(() => {
    if (state.status === "error" && picked) getSlots().then(setSlots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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

  if (state.status === "success" && state.slot) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-snow text-sky">
          <CalendarCheck className="h-6 w-6" strokeWidth={1.8} />
        </span>
        <div>
          <p className="text-xl font-semibold tracking-tight text-snow">Du bist im Kalender. 🎉</p>
          <p className="mt-2 max-w-md text-sm font-light leading-relaxed text-snow/70">
            {long.format(new Date(state.slot.start))} um {time.format(new Date(state.slot.start))} Uhr. Die Einladung
            mit Teams-Link kommt gleich per Mail von hello@grid-agency.de. Giulia freut sich auf dich.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <div className="flex items-center gap-3 text-sm font-light text-snow/70">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-snow/10">
          <Video className="h-4 w-4 text-snow" strokeWidth={1.8} />
        </span>
        <p>
          <span className="font-medium text-snow">Erstgespräch mit Giulia</span> · 30 Min · Teams · kostenlos
        </p>
      </div>

      {slots === undefined && (
        <div aria-busy className="mt-5 space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="skeleton h-16 w-14 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="skeleton h-10 rounded-full" />
            ))}
          </div>
          <span className="sr-only">Freie Termine werden geladen …</span>
        </div>
      )}

      {(slots === null || (slots && slots.length === 0)) && (
        <div className="mt-5 rounded-2xl border border-snow/10 p-5 text-sm font-light text-snow/70">
          {slots === null
            ? "Der Kalender ist gerade nicht erreichbar."
            : "In den nächsten Wochen ist leider alles voll."}{" "}
          {onUnavailable && (
            <button type="button" onClick={onUnavailable} className="font-medium text-snow underline underline-offset-4">
              Schreib uns stattdessen eine Nachricht
            </button>
          )}
        </div>
      )}

      {slots && slots.length > 0 && (
        <>
          <div role="listbox" aria-label="Tag wählen" className="no-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
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
                  className={`flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 transition-colors ${
                    active ? "border-snow bg-snow text-sky" : "border-snow/12 bg-snow/[0.04] text-snow hover:bg-snow/10"
                  }`}
                >
                  <span className="text-[0.6875rem] font-medium uppercase opacity-70">{weekday.format(date)}</span>
                  <span className="text-lg font-semibold leading-tight">{dayNum.format(date)}</span>
                  <span className="text-[0.625rem] font-light opacity-70">{month.format(date)}</span>
                </button>
              );
            })}
          </div>

          <div role="listbox" aria-label="Uhrzeit wählen" className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {daySlots.map((slot) => {
              const active = picked?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setPicked(slot)}
                  className={`rounded-full border py-2.5 text-sm font-medium tabular-nums transition-colors ${
                    active ? "border-transparent bg-snow text-sky" : "border-snow/12 text-snow hover:bg-snow/10"
                  }`}
                >
                  {time.format(new Date(slot.start))}
                </button>
              );
            })}
          </div>

          {picked && (
            <form action={action} className="details-body mt-6 space-y-3 border-t border-snow/10 pt-6">
              <p className="text-sm font-light text-snow/70">
                <span className="font-medium text-snow">{long.format(new Date(picked.start))}</span>, {time.format(new Date(picked.start))} Uhr
              </p>
              <input type="hidden" name="start" value={picked.start} />
              {/* Honeypot */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
              <div className="grid grid-cols-2 gap-3">
                <input name="name" required placeholder="Name *" autoComplete="name" className={inputClasses} />
                <input name="email" type="email" required placeholder="E-Mail *" autoComplete="email" className={inputClasses} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input name="company" placeholder="Marke / Unternehmen" autoComplete="organization" className={inputClasses} />
                <input name="phone" type="tel" placeholder="Telefon" autoComplete="tel" className={inputClasses} />
              </div>
              <textarea name="message" rows={3} placeholder="Worum geht's? (optional)" className={inputClasses} />
              <div className="flex flex-col items-start gap-3 pt-1 sm:flex-row sm:items-center">
                <SubmitButton />
                {state.status === "error" && <p className="text-sm text-red-400">{state.message}</p>}
              </div>
              <p className="text-[0.6875rem] font-light leading-relaxed text-snow/45">
                Wir legen den Termin in unserem Microsoft-365-Kalender an und schicken dir die Einladung. Mehr in der{" "}
                <a href="/datenschutz#termine" className="underline underline-offset-2 hover:text-snow/70">
                  Datenschutzerklärung
                </a>
                .
              </p>
            </form>
          )}
        </>
      )}
    </div>
  );
}
