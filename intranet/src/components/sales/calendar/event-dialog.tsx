"use client";

import { useRef, useState } from "react";
import { CalendarPlus, Video } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { mailboxLabel } from "@/lib/config";
import { graphFor, type Calendar } from "@/lib/graph";
import { useCan } from "@/components/access";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { Button, Dialog, useToast } from "@/components/ui";
import { isEmail, parseAddresses } from "../mail/format";
import { JourFixForm, Switch } from "../jourfix";
import { addDays, toInput } from "./dates";

const REMINDERS: [number | null, string][] = [
  [null, "Keine Erinnerung"],
  [0, "Zum Beginn"],
  [5, "5 Minuten vorher"],
  [15, "15 Minuten vorher"],
  [30, "30 Minuten vorher"],
  [60, "1 Stunde vorher"],
  [1440, "1 Tag vorher"],
];

/** Neuer Termin in einem der Kalender des Bereichs */
export function EventDialog({
  start,
  calendars,
  onClose,
  onCreated,
}: {
  start: Date | null;
  calendars: Calendar[];
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <Dialog open={!!start} onClose={onClose} title="Neuer Termin" width="max-w-3xl">
      {start && <EventChoice key={start.toISOString()} start={start} calendars={calendars} onClose={onClose} onCreated={onCreated} />}
    </Dialog>
  );
}

/** „Wiederholen“ macht aus dem Termin einen Jour fixe (Serie mit festem
 * Meet-Link, angelegt über den Server). Nur mit Zugriff auf Sales. */
function EventChoice(props: { start: Date; calendars: Calendar[]; onClose: () => void; onCreated: () => void }) {
  const canRepeat = useCan("sales");
  const [repeat, setRepeat] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {canRepeat && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink/60 px-4 py-3">
          <Switch checked={repeat} onChange={setRepeat} label="Wiederholen" />
          <span className="text-right text-xs text-snow/50">{repeat ? "Jour fixe mit festem Link" : "Einzeltermin"}</span>
        </div>
      )}
      {repeat ? (
        <JourFixForm start={props.start} onCancel={props.onClose} onCreated={props.onCreated} />
      ) : (
        <EventForm {...props} />
      )}
    </div>
  );
}

function EventForm({
  start,
  calendars,
  onClose,
  onCreated,
}: {
  start: Date;
  calendars: Calendar[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const editable = calendars.filter((c) => c.canEdit);
  const multiple = editable.length > 1;
  const toast = useToast();
  const editor = useRef<RichEditorHandle>(null);
  const [subject, setSubject] = useState("");
  const [calendarId, setCalendarId] = useState(editable.find((c) => c.isDefaultCalendar)?.id ?? editable[0]?.id ?? "");
  const [required, setRequired] = useState("");
  const [optional, setOptional] = useState("");
  const [day, setDay] = useState(toInput(start, false));
  const [fromTime, setFromTime] = useState(toInput(start).slice(11, 16));
  const [toTime, setToTime] = useState(toInput(new Date(start.getTime() + 30 * 60_000)).slice(11, 16));
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [meet, setMeet] = useState(true);
  const [record, setRecord] = useState(true);
  const [reminder, setReminder] = useState<number | null>(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendar = editable.find((c) => c.id === calendarId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subject.trim()) return setError("Titel fehlt.");
    if (!calendar) return setError("Kein beschreibbarer Kalender vorhanden.");
    const requiredList = parseAddresses(required);
    const optionalList = parseAddresses(optional);
    const invalid = [...requiredList, ...optionalList].find((a) => !isEmail(a));
    if (invalid) return setError(`„${invalid}“ ist keine gültige E-Mail-Adresse.`);
    const startDate = new Date(`${day}T${allDay ? "00:00" : fromTime}`);
    // Ganztägig: Ende ist exklusiv, also der nächste Tag
    const endDate = allDay ? addDays(new Date(`${day}T00:00`), 1) : new Date(`${day}T${toTime}`);
    if (Number.isNaN(startDate.getTime()) || !(endDate > startDate)) return setError("Das Ende muss nach dem Beginn liegen.");

    setBusy(true);
    try {
      let place = location.trim();
      let body = editor.current?.html() ?? "";
      if (meet && !allDay) {
        const room = await api<{ url: string }>("/api/kalender/meet", {
          method: "POST",
          body: JSON.stringify({ title: subject.trim(), start: startDate.toISOString(), minutes: Math.round((endDate.getTime() - startDate.getTime()) / 60_000), record }),
        });
        place = room.url;
        body = `<p>Zum Video-Call über GRID Meet: <a href="${room.url}">${room.url}</a></p>${body}`;
      }
      await graphFor(calendar.mailbox).createEvent(calendar.id, {
        subject: subject.trim(),
        start: startDate,
        end: endDate,
        isAllDay: allDay,
        location: place,
        required: requiredList,
        optional: optionalList,
        body,
        reminder,
      });
      toast(requiredList.length || optionalList.length ? "Termin eingetragen, Einladung ist raus" : "Termin eingetragen");
      onCreated();
    } catch {
      setError("Eintragen fehlgeschlagen. Hat dein Konto Schreibzugriff auf diesen Kalender?");
      setBusy(false);
    }
  }

  const input = "h-11 w-full rounded-xl border border-snow/10 bg-surface px-3.5 text-[14px] text-snow outline-none placeholder:text-snow/35 focus:border-snow/35 disabled:bg-snow/[0.05] disabled:text-snow/45";
  const label = "pt-3 text-[13px] font-medium text-snow/60";

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="-mt-2 text-[13px] text-snow/55">
        Im Kalender von {calendar?.mailbox ?? "–"}; Microsoft schickt die Einladung.
      </p>
      <div className="grid grid-cols-[96px_1fr] items-start gap-x-3 gap-y-2.5">
        <label htmlFor="ev-title" className={label}>
          Titel
        </label>
        <input id="ev-title" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus className={input} />

        <label htmlFor="ev-required" className={label}>
          Teilnehmer
        </label>
        <input id="ev-required" value={required} onChange={(e) => setRequired(e.target.value)} placeholder="name@firma.de, …" className={input} />

        <label htmlFor="ev-optional" className={label}>
          Optional
        </label>
        <input id="ev-optional" value={optional} onChange={(e) => setOptional(e.target.value)} className={input} />

        <span className={label}>Wann</span>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" aria-label="Datum" value={day} onChange={(e) => setDay(e.target.value)} className={cn(input, "w-auto")} />
          {!allDay && (
            <>
              <input type="time" aria-label="Beginn" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className={cn(input, "w-auto")} />
              <span className="text-[14px] text-snow/60">bis</span>
              <input type="time" aria-label="Ende" value={toTime} onChange={(e) => setToTime(e.target.value)} className={cn(input, "w-auto")} />
            </>
          )}
          <label className="ml-1 flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="h-4 w-4 accent-current" />
            Ganztägig
          </label>
        </div>

        <label htmlFor="ev-location" className={label}>
          Ort
        </label>
        <input
          id="ev-location"
          value={meet && !allDay ? "" : location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={meet && !allDay}
          placeholder={meet && !allDay ? "GRID Meet (Link wird beim Eintragen erstellt)" : "Adresse oder Raum"}
          className={input}
        />

        {multiple && (
          <>
            <label htmlFor="ev-calendar" className={label}>
              Kalender
            </label>
            <select id="ev-calendar" value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className={input}>
              {editable.map((c) => (
                <option key={c.id} value={c.id}>
                  {mailboxLabel(c.mailbox)} · {c.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={meet}
          disabled={allDay}
          onClick={() => setMeet((v) => !v)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors disabled:opacity-40",
            meet ? "bg-snow text-sky" : "border border-snow/15 text-snow/80 hover:border-snow/30"
          )}
        >
          <Video className="h-4 w-4" /> GRID Meet
        </button>
        <button
          type="button"
          aria-pressed={record && meet && !allDay}
          disabled={!meet || allDay}
          onClick={() => setRecord((v) => !v)}
          title="Ton aufzeichnen und danach Zusammenfassung und Aufgaben erstellen"
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors disabled:opacity-40",
            record && meet && !allDay ? "bg-snow text-sky" : "border border-snow/15 text-snow/80 hover:border-snow/30"
          )}
        >
          <span className={cn("h-3 w-3 rounded-full", record && meet && !allDay ? "bg-[#ec5b54]" : "border-2 border-current")} aria-hidden /> Aufzeichnen
        </button>
      </div>

      <select aria-label="Erinnerung" value={reminder ?? ""} onChange={(e) => setReminder(e.target.value === "" ? null : Number(e.target.value))} className={cn(input, "font-medium")}>
        {REMINDERS.map(([value, text]) => (
          <option key={text} value={value ?? ""}>
            Erinnerung: {text}
          </option>
        ))}
      </select>

      <RichEditor ref={editor} placeholder="Agenda, Hinweise …" className="min-h-56" />

      <div className="flex items-center gap-3 pt-1">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Verwerfen
        </Button>
        <p role={error ? "alert" : undefined} className="min-w-0 flex-1 text-[13px] text-snow/55">
          {error ?? (!subject.trim() ? "Titel fehlt." : "")}
        </p>
        <Button type="submit" variant="primary" icon={<CalendarPlus className="h-4 w-4" />} loading={busy} loadingText="Wird eingetragen …" disabled={!subject.trim()}>
          Eintragen
        </Button>
      </div>
    </form>
  );
}
