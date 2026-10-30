"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { CalendarCheck, CircleCheck, Clock, Video } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button, Spinner } from "@/components/ui";

type View = {
  first_name: string;
  position_title: string | null;
  inviter: string;
  minutes: number;
  booked: { start: string; url: string | null } | null;
  slots: string[];
  calendar_error: boolean;
};

const TZ = "Europe/Berlin";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekday = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "numeric", month: "numeric" });
const longDay = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const range = (start: string, minutes: number) => {
  const from = new Date(start);
  return `${time.format(from)}–${time.format(new Date(from.getTime() + minutes * 60_000))} Uhr`;
};

/** Terminwahl für eingeladene Bewerber*innen: freie Slots aus dem Kalender
 * der einladenden Person, ein Klick bucht den Teams-Termin. */
export function Booking({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);

  const load = () =>
    fetch(`/api/termin/${token}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Link ungültig");
        setView(data);
      })
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal beim Öffnen
  }, [token]);

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of view?.slots ?? []) {
      const key = dayKey.format(new Date(s));
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [view]);
  const activeDay = day ?? days[0]?.[0] ?? null;
  const daySlots = days.find(([key]) => key === activeDay)?.[1] ?? [];

  async function book() {
    if (!slot) return;
    setBooking(true);
    setBookError(null);
    try {
      const response = await fetch(`/api/termin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: slot }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Buchung fehlgeschlagen");
      setView((v) => v && { ...v, booked: data, slots: [] });
    } catch (e) {
      setBookError((e as Error).message);
      setSlot(null);
      load();
    }
    setBooking(false);
  }

  return (
    <div className="min-h-dvh bg-sky text-snow">
      <header className="border-b border-snow/[0.08]">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 md:px-6">
          <Logo className="h-6" priority />
          <span className="rounded-full border border-snow/15 px-2.5 py-0.5 text-[11px] tracking-[0.2em] text-snow/60 uppercase">termin</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        {error ? (
          <Message title="Link nicht gültig" text={error} />
        ) : !view ? (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        ) : view.booked ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-snow/10 bg-surface px-6 py-12 text-center">
            <CircleCheck className="h-12 w-12 text-success" strokeWidth={1.5} />
            <h1 className="text-2xl font-medium tracking-tight">Dein Termin steht</h1>
            <p className="text-[15px] text-snow/80">
              {longDay.format(new Date(view.booked.start))}, {range(view.booked.start, view.minutes)}
            </p>
            <p className="max-w-md text-[14px] text-snow/55">
              Die Einladung mit dem Teams-Link kommt gleich per Mail. Wir freuen uns auf dich, {view.first_name}!
            </p>
            {view.booked.url && (
              <a
                href={view.booked.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 py-2 text-sm font-medium hover:bg-snow/12"
              >
                <Video className="h-4 w-4" /> Teams-Link
              </a>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs font-medium tracking-[0.2em] text-snow/50 uppercase">Kennenlernen</p>
            <h1 className="mt-2 text-2xl font-medium tracking-tight md:text-3xl">Hi {view.first_name}, such dir einen Termin aus</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-snow/60">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {view.minutes} Minuten
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Video className="h-4 w-4" /> Microsoft Teams mit {view.inviter}
              </span>
            </p>

            {view.calendar_error || !days.length ? (
              <Message
                title={view.calendar_error ? "Kalender gerade nicht erreichbar" : "Gerade keine freien Termine"}
                text="Antworte einfach auf unsere Einladungsmail, dann finden wir zusammen einen Termin."
              />
            ) : (
              <>
                <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
                  {days.map(([key, list]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDay(key);
                        setSlot(null);
                      }}
                      aria-pressed={key === activeDay}
                      className={clsx(
                        "flex w-16 shrink-0 flex-col items-center rounded-2xl border px-2 py-2.5 transition-colors",
                        key === activeDay ? "border-snow bg-snow text-sky" : "border-snow/12 bg-surface hover:border-snow/30"
                      )}
                    >
                      <span className="text-[11px] uppercase opacity-70">{weekday.format(new Date(list[0]))}</span>
                      <span className="text-[15px] font-medium">{dayMonth.format(new Date(list[0]))}</span>
                    </button>
                  ))}
                </div>

                <p className="mt-6 text-[13px] text-snow/50">
                  {activeDay && daySlots[0] && longDay.format(new Date(daySlots[0]))} · Zeiten in deutscher Zeit
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {daySlots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      aria-pressed={slot === s}
                      className={clsx(
                        "rounded-xl border py-2.5 text-[14px] font-medium transition-colors",
                        slot === s ? "border-snow bg-snow text-sky" : "border-snow/12 bg-surface hover:border-snow/30"
                      )}
                    >
                      {time.format(new Date(s))}
                    </button>
                  ))}
                </div>

                {bookError && <p className="mt-5 rounded-2xl bg-error/10 px-4 py-3 text-[13px] text-error">{bookError}</p>}

                <div className="sticky bottom-0 -mx-4 mt-8 border-t border-snow/[0.08] bg-sky/95 px-4 py-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-snow/75">
                      <CalendarCheck className="h-4 w-4 shrink-0" />
                      {slot ? `${longDay.format(new Date(slot))}, ${range(slot, view.minutes)}` : "Wähl eine Uhrzeit"}
                    </p>
                    <Button variant="primary" disabled={!slot} loading={booking} loadingText="Wird gebucht …" onClick={book}>
                      Termin buchen
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-10 text-[12px] text-snow/40 md:px-6">
        GRID AGENCY UG ·{" "}
        <a href="https://grid-agency.de/datenschutz#bewerbungen" className="underline hover:text-snow/70">
          Datenschutz
        </a>{" "}
        ·{" "}
        <a href="https://grid-agency.de/impressum" className="underline hover:text-snow/70">
          Impressum
        </a>
      </footer>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-8 rounded-3xl border border-snow/10 bg-surface px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-snow/55">{text}</p>
    </div>
  );
}
