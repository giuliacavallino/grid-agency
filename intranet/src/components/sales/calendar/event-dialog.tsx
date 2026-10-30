"use client";

import { useState } from "react";
import { useCan } from "@/components/access";
import { mailboxLabel } from "@/lib/config";
import { graphFor, type Calendar } from "@/lib/graph";
import { Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";
import { JourFixForm, Switch } from "../jourfix";
import { addDays, fromInput, toInput } from "./dates";

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
    <Dialog open={!!start} onClose={onClose} title="Neuer Termin" width="max-w-xl">
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
  const multiple = new Set(editable.map((c) => c.mailbox)).size > 1;
  const toast = useToast();
  const [subject, setSubject] = useState("");
  const [calendarId, setCalendarId] = useState(editable.find((c) => c.isDefaultCalendar)?.id ?? editable[0]?.id ?? "");
  const [allDay, setAllDay] = useState(false);
  const [from, setFrom] = useState(toInput(start));
  const [to, setTo] = useState(toInput(new Date(start.getTime() + 60 * 60_000)));
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAllDay(value: boolean) {
    setAllDay(value);
    setFrom((v) => (value ? v.slice(0, 10) : `${v.slice(0, 10)}T09:00`));
    setTo((v) => (value ? v.slice(0, 10) : `${v.slice(0, 10)}T10:00`));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subject.trim()) return setError("Bitte einen Titel eintragen.");
    if (!calendarId) return setError("Kein beschreibbarer Kalender vorhanden.");
    const startDate = fromInput(from);
    // Ganztägig: Ende ist exklusiv, also der Tag nach dem letzten Tag
    const endDate = allDay ? addDays(fromInput(to), 1) : fromInput(to);
    if (!(endDate > startDate)) return setError("Das Ende muss nach dem Beginn liegen.");

    setBusy(true);
    try {
      const calendar = editable.find((c) => c.id === calendarId)!;
      await graphFor(calendar.mailbox).createEvent(calendarId, { subject: subject.trim(), start: startDate, end: endDate, isAllDay: allDay, location: location.trim() });
      toast("Termin angelegt");
      onCreated();
    } catch {
      setError("Anlegen fehlgeschlagen. Hat dein Konto Schreibzugriff auf diesen Kalender?");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Titel" className="col-span-2">
        {(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus placeholder="z. B. Erstgespräch Studio Nord" />}
      </Field>
      <Field label="Kalender">
        {(id) => (
          <Select id={id} value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
            {editable.map((c) => (
              <option key={c.id} value={c.id}>
                {multiple ? `${mailboxLabel(c.mailbox)} · ${c.name}` : c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <label className="flex items-end gap-2 pb-2.5 text-sm">
        <input type="checkbox" checked={allDay} onChange={(e) => toggleAllDay(e.target.checked)} className="h-4 w-4 accent-current" />
        Ganztägig
      </label>
      <Field label="Beginn">
        {(id) => <Input id={id} type={allDay ? "date" : "datetime-local"} value={from} onChange={(e) => setFrom(e.target.value)} />}
      </Field>
      <Field label="Ende">
        {(id) => <Input id={id} type={allDay ? "date" : "datetime-local"} value={to} onChange={(e) => setTo(e.target.value)} />}
      </Field>
      <Field label="Ort" className="col-span-2">
        {(id) => <Input id={id} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Adresse oder Microsoft Teams" />}
      </Field>
      {error && (
        <p role="alert" className="col-span-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" loading={busy} loadingText="Wird angelegt …">
          Termin anlegen
        </Button>
      </div>
    </form>
  );
}
