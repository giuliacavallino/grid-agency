"use client";

import { useState } from "react";
import { CalendarClock, CalendarDays, Clock, ExternalLink, MapPin, Pencil, Repeat, Trash2, Users, Video } from "lucide-react";
import { graphFor, type CalEvent, type Calendar } from "@/lib/graph";
import { useCan } from "@/components/access";
import { Button, Dialog, Field, Input, Sheet, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { JourFixEditDialog, useJourFixFor } from "../jourfix";
import { addDays, sameDay, time } from "./dates";

const RESPONSE: Record<string, string> = {
  accepted: "Zugesagt",
  tentativelyAccepted: "Vorläufig",
  declined: "Abgesagt",
  organizer: "Organisation",
  none: "Keine Antwort",
  notResponded: "Keine Antwort",
};

function when(event: CalEvent) {
  const day = (d: Date) => d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (event.isAllDay) {
    const last = addDays(event.end, -1);
    return sameDay(event.start, last) ? `${day(event.start)} · ganztägig` : `${day(event.start)} – ${day(last)}`;
  }
  if (sameDay(event.start, event.end)) return `${day(event.start)} · ${time(event.start)}–${time(event.end)}`;
  return `${day(event.start)} ${time(event.start)} – ${day(event.end)} ${time(event.end)}`;
}

export function EventSheet({
  event,
  calendar,
  onClose,
  onDeleted,
}: {
  event: CalEvent | null;
  calendar?: Calendar;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  // Jour fixe (Serie mit festem Meet-Link) lassen sich hier bearbeiten
  const jourFix = useJourFixFor(event, useCan("sales"));
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState(false);
  const [comment, setComment] = useState("Leider muss ich den Termin absagen. Die Einladung ging versehentlich raus.");
  const toast = useToast();
  // Eingeladene außer dem eigenen Kalender: dann als Absage schicken
  const invited = (event?.attendees ?? []).filter((a) => a.address && a.address.toLowerCase() !== calendar?.mailbox.toLowerCase());

  async function remove() {
    if (!event || !calendar) return;
    setBusy(true);
    try {
      if (invited.length) {
        await graphFor(calendar.mailbox).cancelEvent(event.id, comment.trim());
        toast(`Abgesagt, ${invited.map((a) => a.name || a.address).join(", ")} ${invited.length === 1 ? "bekommt" : "bekommen"} die Absage`);
      } else {
        await graphFor(calendar.mailbox).deleteEvent(event.id);
        toast("Termin gelöscht");
      }
      setConfirm(false);
      onDeleted();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Sheet
      open={!!event}
      onClose={onClose}
      width="max-w-md"
      title={
        event && (
          <span className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: calendar?.color }} />
            <span className="truncate">{event.subject}</span>
          </span>
        )
      }
      subtitle={calendar?.name}
    >
      {event && (
        <div className="flex flex-col gap-5 p-5 text-sm">
          <Row icon={Clock}>{when(event)}</Row>
          {event.recurring && (
            <Row icon={Repeat}>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {jourFix ? `Jour fixe · ${jourFix.rhythm}` : "Termin einer Serie"}
                {jourFix && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-snow/15 px-3 text-[13px] font-medium hover:bg-snow/[0.06]"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Serie bearbeiten
                  </button>
                )}
              </span>
            </Row>
          )}
          {event.location && <Row icon={MapPin}>{event.location}</Row>}
          {event.joinUrl && (
            <a
              href={event.joinUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-snow px-4 font-medium text-sky hover:opacity-90"
            >
              <Video className="h-4 w-4" /> {event.joinUrl.includes("teams.microsoft") ? "An Teams-Besprechung teilnehmen" : "Am Video-Call teilnehmen"}
            </a>
          )}
          {event.organizer && <Row icon={CalendarDays}>Organisiert von {event.organizer}</Row>}
          {event.attendees.length > 0 && (
            <Row icon={Users}>
              <ul className="flex flex-col gap-1.5">
                {event.attendees.map((a) => (
                  <li key={a.address} className="flex flex-wrap items-baseline gap-x-2">
                    <span>{a.name || a.address}</span>
                    <span className="text-[12px] text-snow/45">{RESPONSE[a.response] ?? a.response}</span>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {event.bodyPreview && (
            <p className="rounded-2xl bg-ink p-4 leading-relaxed whitespace-pre-wrap text-snow/75">{event.bodyPreview}</p>
          )}
          <div className="flex flex-wrap gap-2 border-t border-snow/10 pt-5">
            {event.webLink && (
              <a
                href={event.webLink}
                target="_blank"
                rel="noopener"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 font-medium hover:bg-snow/12"
              >
                <ExternalLink className="h-4 w-4" /> In Outlook öffnen
              </a>
            )}
            {calendar?.canEdit && !event.recurring && (
              <Button variant="ghost" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setMoving(true)}>
                Verschieben
              </Button>
            )}
            {calendar?.canEdit && (
              <Button variant="ghost" className="text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>
                {event.attendees.some((a) => a.address && a.address.toLowerCase() !== calendar.mailbox.toLowerCase()) ? "Absagen" : "Löschen"}
              </Button>
            )}
          </div>
        </div>
      )}
      {moving && event && calendar && (
        <MoveDialog
          event={event}
          mailbox={calendar.mailbox}
          invited={invited.length}
          onClose={() => setMoving(false)}
          onSaved={() => {
            setMoving(false);
            onDeleted();
          }}
        />
      )}
      <JourFixEditDialog
        jourFix={editing ? jourFix : null}
        attendees={event?.attendees
          .map((a) => a.address.toLowerCase())
          .filter((a) => a && a !== calendar?.mailbox.toLowerCase() && a !== jourFix?.mailbox?.toLowerCase())}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onDeleted();
        }}
      />
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={invited.length ? "Termin absagen?" : "Termin löschen?"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy} loadingText={invited.length ? "Absage wird gesendet …" : "Wird gelöscht …"} onClick={remove}>
              {invited.length ? "Absage senden" : "Löschen"}
            </Button>
          </>
        }
      >
        {invited.length ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-snow/60">
              „{event?.subject}“ wird aus dem Kalender {calendar?.mailbox} entfernt. {invited.map((a) => a.name || a.address).join(", ")}{" "}
              {invited.length === 1 ? "bekommt" : "bekommen"} eine Absage mit dieser Nachricht:
            </p>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Nachricht zur Absage" className="min-h-24" />
          </div>
        ) : (
          <p className="text-sm text-snow/60">„{event?.subject}“ wird aus dem Kalender {calendar?.mailbox} entfernt.</p>
        )}
      </Dialog>
    </Sheet>
  );
}

function Row({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-snow/45" />
      <div className="min-w-0 flex-1 text-snow/85">{children}</div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const MEET_CODE = /meet\.grid-agency\.de\/([a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3})/;

/** Einzeltermin verschieben: neue Zeit (und Titel); Microsoft schickt den
 * Eingeladenen die Aktualisierung, der GRID-Meet-Raum zieht mit */
function MoveDialog({ event, mailbox, invited, onClose, onSaved }: { event: CalEvent; mailbox: string; invited: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState(event.subject);
  const [day, setDay] = useState(dayInput(event.start));
  const [from, setFrom] = useState(timeInput(event.start));
  const [to, setTo] = useState(timeInput(event.end));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Neue Startzeit: Dauer beibehalten
  function changeFrom(value: string) {
    const minutes = (event.end.getTime() - event.start.getTime()) / 60_000;
    setFrom(value);
    const start = new Date(`${day}T${value}`);
    if (!Number.isNaN(start.getTime())) setTo(timeInput(new Date(start.getTime() + minutes * 60_000)));
  }

  async function save() {
    const start = new Date(`${day}T${from}`);
    const end = new Date(`${day}T${to}`);
    if (Number.isNaN(start.getTime()) || !(end > start)) return setError("Das Ende muss nach dem Beginn liegen.");
    setBusy(true);
    setError(null);
    try {
      await graphFor(mailbox).updateEvent(event.id, { subject: subject.trim() || undefined, start, end });
      const code = `${event.location ?? ""} ${event.joinUrl ?? ""} ${event.bodyPreview}`.match(MEET_CODE)?.[1];
      if (code) {
        await api("/api/kalender/meet", {
          method: "PATCH",
          body: JSON.stringify({ code, start: start.toISOString(), minutes: Math.round((end.getTime() - start.getTime()) / 60_000), title: subject.trim() }),
        }).catch(() => {});
      }
      toast(invited ? "Verschoben, die Eingeladenen bekommen die Aktualisierung" : "Verschoben");
      onSaved();
    } catch {
      setError("Verschieben fehlgeschlagen. Ist der Termin aus deinem Kalender und von dir organisiert?");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Termin verschieben"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<CalendarClock className="h-4 w-4" />} loading={busy} loadingText="Wird verschoben …" onClick={save}>
            {invited ? "Verschieben und Update senden" : "Verschieben"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Titel">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <Field label="Tag">{(id) => <Input id={id} type="date" value={day} onChange={(e) => setDay(e.target.value)} />}</Field>
          <Field label="Von">{(id) => <Input id={id} type="time" step={300} value={from} onChange={(e) => changeFrom(e.target.value)} />}</Field>
          <Field label="Bis">{(id) => <Input id={id} type="time" step={300} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
        </div>
        {invited > 0 && <p className="text-[13px] text-snow/55">Microsoft schickt allen Eingeladenen die neue Zeit; der GRID-Meet-Link bleibt gleich.</p>}
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </Dialog>
  );
}
