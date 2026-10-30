"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarCheck, LoaderCircle, Video } from "lucide-react";
import { bookSlot, loadBooking, type BookingView, type MeetingKind } from "@/app/actions/booking";
import { Altcha } from "@/components/Altcha";

// Eigene Terminbuchung statt Calendly: freie Slots aus dem Outlook-Kalender
// (über das Intranet), Tag → Uhrzeit → Angaben → gebucht. Die Einladung mit
// Teams-Link kommt per Outlook. Mit Einladungslink (?l=…) ist die Person
// schon bekannt; „kickoff“ geht nur mit Link.

const TZ = "Europe/Berlin";
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
const dayLabel = (iso: string) => ({
  weekday: new Date(iso).toLocaleDateString("de-DE", { timeZone: TZ, weekday: "short" }),
  date: new Date(iso).toLocaleDateString("de-DE", { timeZone: TZ, day: "numeric", month: "short" }),
});
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const longLabel = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

const input =
  "w-full rounded-lg border border-sky/15 bg-white px-3 py-2.5 text-sm text-sky placeholder:text-sky/40 outline-none transition-colors focus:border-sky/50";

export function BookingWidget({ kind = "erstgespraech", token = null }: { kind?: MeetingKind; token?: string | null }) {
  const [view, setView] = useState<BookingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "" });
  const [altcha, setAltcha] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ start: string; url: string | null } | null>(null);

  useEffect(() => {
    loadBooking(kind, token).then((result) => {
      if (!result.ok) return setError(result.error);
      setView(result.data);
      if (result.data.booked) setBooked(result.data.booked);
      if (result.data.prefill) setForm((f) => ({ ...f, ...result.data.prefill }));
      setDay(result.data.slots[0] ? dayKey(result.data.slots[0]) : null);
    });
  }, [kind, token]);

  const days = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of view?.slots ?? []) map.set(dayKey(s), [...(map.get(dayKey(s)) ?? []), s]);
    return [...map.entries()];
  }, [view]);
  const slots = days.find(([key]) => key === day)?.[1] ?? [];
  const known = !!view?.prefill;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!slot) return;
    setSending(true);
    setSendError(null);
    const result = await bookSlot({ kind, token, start: slot, ...form, altcha: altcha ?? "" });
    setSending(false);
    if (!result.ok) {
      setSendError(result.error);
      if (/vergeben/.test(result.error)) {
        setSlot(null);
        loadBooking(kind, token).then((r) => r.ok && setView(r.data));
      }
      return;
    }
    setBooked(result.data);
  }

  if (error) return <p className="p-5 text-sm text-sky/70">{error}</p>;
  if (!view)
    return (
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sky">
        <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2} aria-hidden />
        <span className="text-[0.8125rem] font-light text-sky/70">Freie Termine werden geladen …</span>
      </div>
    );

  if (booked)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sky">
        <motion.span
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2f9e6b]/12 text-[#2f9e6b]"
        >
          <CalendarCheck className="h-6 w-6" strokeWidth={1.8} />
        </motion.span>
        <p className="text-lg font-medium">Termin steht!</p>
        <p className="text-sm font-light text-sky/75">{longLabel(booked.start)} Uhr</p>
        <p className="max-w-xs text-[0.8125rem] font-light leading-relaxed text-sky/60">
          Die Einladung mit Teams-Link ist auf dem Weg in dein Postfach. Wir freuen uns auf dich!
        </p>
        {booked.url && (
          <a href={booked.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] text-sky underline underline-offset-2">
            <Video className="h-4 w-4" /> Teams-Link
          </a>
        )}
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col text-sky">
      <AnimatePresence mode="wait" initial={false}>
        {!slot ? (
          <motion.div key="wahl" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <p className="text-[0.8125rem] font-light text-sky/70">
              {view.minutes} Minuten per Teams mit {view.host.split(" ")[0]}
              {known ? ` · für ${view.prefill?.name.split(" ")[0]}` : ""}
            </p>
            {view.calendar_error || !days.length ? (
              <p className="text-sm text-sky/70">
                Gerade sind keine Termine frei. Schreib uns gern über das{" "}
                <Link href="/#kontakt" className="underline underline-offset-2">
                  Kontaktformular
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="listbox" aria-label="Tag wählen">
                  {days.map(([key, list]) => {
                    const label = dayLabel(list[0]);
                    return (
                      <button
                        key={key}
                        type="button"
                        role="option"
                        aria-selected={key === day}
                        onClick={() => setDay(key)}
                        className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 transition-colors ${
                          key === day ? "border-sky bg-sky text-snow" : "border-sky/15 hover:border-sky/40"
                        }`}
                      >
                        <span className="text-[0.6875rem] uppercase tracking-wider opacity-70">{label.weekday}</span>
                        <span className="text-sm font-medium">{label.date}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto" aria-label="Uhrzeit wählen">
                  {slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className="rounded-lg border border-sky/15 py-2.5 text-sm font-medium tabular-nums transition-colors hover:border-[#fa7e1e] hover:text-[#fa7e1e]"
                    >
                      {timeLabel(s)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="daten"
            onSubmit={submit}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          >
            <button type="button" onClick={() => setSlot(null)} className="inline-flex items-center gap-1.5 self-start text-[0.8125rem] text-sky/70 hover:text-sky">
              <ArrowLeft className="h-4 w-4" /> {longLabel(slot)} Uhr
            </button>
            <div className="grid grid-cols-2 gap-2">
              <input required placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} autoComplete="name" />
              <input
                required
                type="email"
                placeholder="E-Mail *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={input}
                autoComplete="email"
                readOnly={known && !!view.prefill?.email}
              />
              <input placeholder="Unternehmen" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={input} autoComplete="organization" />
              <input placeholder="Telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={input} autoComplete="tel" />
            </div>
            {kind === "erstgespraech" && (
              <textarea
                rows={3}
                placeholder="Worum geht's? (optional)"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className={input}
              />
            )}
            <Altcha light onChange={setAltcha} />
            {sendError && <p className="text-[0.8125rem] text-red-600">{sendError}</p>}
            <button
              type="submit"
              disabled={sending || !altcha}
              aria-busy={sending}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-sky py-3 text-sm font-medium text-snow transition-transform active:scale-[0.98] disabled:cursor-progress disabled:opacity-70"
            >
              {sending && <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2} aria-hidden />}
              {sending ? "Wird gebucht…" : "Termin buchen"}
            </button>
            <p className="text-[0.6875rem] font-light leading-relaxed text-sky/50">
              Wir nutzen deine Angaben für den Termin und die Einladung. Mehr in der{" "}
              <Link href="/datenschutz#terminbuchung" className="underline underline-offset-2">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
