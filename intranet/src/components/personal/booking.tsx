"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { ArrowRight, Briefcase, CalendarCheck, Clock, Video } from "lucide-react";
import { Logo } from "@/components/logo";
import { Avatar, Button, Spinner } from "@/components/ui";

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
    <div className="aurora min-h-dvh bg-sky text-snow">
      <header className="border-b border-snow/[0.08] backdrop-blur">
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
          <Booked view={view} />
        ) : (
          <>
            <p className="rise-in text-xs font-medium tracking-[0.25em] text-snow/55 uppercase">Kennenlernen</p>
            <h1 className="rise-in mt-3 text-[2rem] leading-[1.1] font-semibold tracking-tight md:text-5xl" style={{ "--delay": "80ms" } as React.CSSProperties}>
              Hi {view.first_name},<br />
              <span className="text-aurora">lass uns quatschen.</span>
            </h1>
            <p className="rise-in mt-4 max-w-xl text-[15px] text-snow/65" style={{ "--delay": "160ms" } as React.CSSProperties}>
              Deine Bewerbung hat uns gefallen. Such dir einen Slot aus, der dir passt, wir freuen uns auf dich.
            </p>

            <div
              className="rise-in mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-snow/10 bg-surface/80 p-3 pr-4 backdrop-blur"
              style={{ "--delay": "240ms" } as React.CSSProperties}
            >
              <Avatar name={view.inviter} className="h-11 w-11 text-sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{view.inviter}</p>
                <p className="text-[12px] text-snow/50">GRID Agency</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[12px]">
                <Chip icon={<Clock className="h-3.5 w-3.5" />}>{view.minutes} Min.</Chip>
                <Chip icon={<Video className="h-3.5 w-3.5" />}>Teams</Chip>
                {view.position_title && <Chip icon={<Briefcase className="h-3.5 w-3.5" />}>{view.position_title}</Chip>}
              </div>
            </div>

            {view.calendar_error || !days.length ? (
              <Message
                title={view.calendar_error ? "Kalender gerade nicht erreichbar" : "Gerade keine freien Termine"}
                text="Antworte einfach auf unsere Einladungsmail, dann finden wir zusammen einen Termin."
              />
            ) : (
              <>
                <h2 className="rise-in mt-10 text-[13px] font-medium tracking-[0.2em] text-snow/55 uppercase" style={{ "--delay": "320ms" } as React.CSSProperties}>
                  1 · Tag wählen
                </h2>
                <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0">
                  {days.map(([key, list], i) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDay(key);
                        setSlot(null);
                      }}
                      aria-pressed={key === activeDay}
                      style={{ "--delay": `${360 + i * 35}ms` } as React.CSSProperties}
                      className={clsx(
                        "rise-in flex w-[4.5rem] shrink-0 flex-col items-center rounded-2xl px-2 py-3 transition-[transform,box-shadow] hover:-translate-y-0.5",
                        key === activeDay ? "border-aurora shadow-[0_10px_30px_rgb(250_126_30/0.25)]" : "border border-snow/12 bg-surface hover:border-snow/30"
                      )}
                    >
                      <span className="text-[11px] uppercase opacity-60">{weekday.format(new Date(list[0]))}</span>
                      <span className="text-[17px] font-semibold">{dayMonth.format(new Date(list[0]))}</span>
                      <span className="mt-0.5 text-[10px] opacity-50">{list.length} frei</span>
                    </button>
                  ))}
                </div>

                <h2 className="mt-8 text-[13px] font-medium tracking-[0.2em] text-snow/55 uppercase">2 · Uhrzeit wählen</h2>
                <p className="mt-1 text-[13px] text-snow/45">
                  {activeDay && daySlots[0] && longDay.format(new Date(daySlots[0]))} · deutsche Zeit
                </p>
                <div key={activeDay} className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {daySlots.map((s, i) => (
                    <button
                      key={s}
                      style={{ "--delay": `${i * 25}ms` } as React.CSSProperties}
                      type="button"
                      onClick={() => setSlot(s)}
                      aria-pressed={slot === s}
                      className={clsx(
                        "rise-in rounded-xl py-3 text-[15px] font-semibold transition-[transform,box-shadow] hover:-translate-y-0.5 active:scale-95",
                        slot === s ? "bg-snow text-sky shadow-[0_10px_30px_rgb(214_41_118/0.25)]" : "border border-snow/12 bg-surface hover:border-snow/30"
                      )}
                    >
                      {time.format(new Date(s))}
                    </button>
                  ))}
                </div>

                {bookError && <p className="mt-5 rounded-2xl bg-error/10 px-4 py-3 text-[13px] text-error">{bookError}</p>}

                <div className="sticky bottom-0 -mx-4 mt-8 border-t border-snow/[0.08] bg-sky/90 px-4 py-4 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:border-snow/10 md:bg-surface/80 md:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="flex min-w-0 flex-1 items-center gap-2 text-[14px] text-snow/80">
                      <CalendarCheck className={clsx("h-5 w-5 shrink-0", slot ? "text-success" : "text-snow/40")} />
                      {slot ? (
                        <span>
                          <span className="font-medium">{longDay.format(new Date(slot))}</span>, {range(slot, view.minutes)}
                        </span>
                      ) : (
                        "Wähl eine Uhrzeit"
                      )}
                    </p>
                    <Button
                      variant="primary"
                      className="h-11 px-6"
                      disabled={!slot}
                      loading={booking}
                      loadingText="Wird gebucht …"
                      onClick={book}
                    >
                      Termin buchen <ArrowRight className="h-4 w-4" />
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

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-snow/[0.07] px-2.5 py-1 text-snow/75">
      {icon}
      {children}
    </span>
  );
}

/** Bestätigung: Haken zeichnet sich, Aurora-Puls, Termin groß */
function Booked({ view }: { view: View }) {
  const start = view.booked!.start;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-snow/10 bg-surface/80 px-6 py-14 text-center backdrop-blur">
      <div className="relative mx-auto h-20 w-20">
        <span className="glow-pulse absolute inset-0 rounded-full" style={{ backgroundImage: "var(--aurora)" }} />
        <svg viewBox="0 0 80 80" className="relative h-20 w-20 text-success" aria-hidden>
          <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="draw" style={{ "--length": 227 } as React.CSSProperties} transform="rotate(-90 40 40)" />
          <path
            d="M25 41 l10 10 l20 -22"
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="draw"
            style={{ "--length": 46, "--delay": "450ms" } as React.CSSProperties}
          />
        </svg>
      </div>
      <h1 className="rise-in mt-6 text-3xl font-semibold tracking-tight md:text-4xl" style={{ "--delay": "500ms" } as React.CSSProperties}>
        <span className="text-aurora">Dein Termin steht!</span>
      </h1>
      <p className="rise-in mt-3 text-[17px] font-medium" style={{ "--delay": "600ms" } as React.CSSProperties}>
        {longDay.format(new Date(start))}
      </p>
      <p className="rise-in text-[15px] text-snow/70" style={{ "--delay": "650ms" } as React.CSSProperties}>
        {range(start, view.minutes)} · Teams mit {view.inviter}
      </p>
      <p className="rise-in mx-auto mt-5 max-w-md text-[14px] text-snow/55" style={{ "--delay": "750ms" } as React.CSSProperties}>
        Die Einladung mit Teams-Link kommt gleich per Mail. Wir freuen uns auf dich, {view.first_name}!
      </p>
      {view.booked!.url && (
        <a
          href={view.booked!.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-rainbow rise-in mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-snow px-6 text-sm font-medium text-sky"
          style={{ "--delay": "850ms" } as React.CSSProperties}
        >
          <Video className="h-4 w-4" /> Teams-Link öffnen
        </a>
      )}
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
