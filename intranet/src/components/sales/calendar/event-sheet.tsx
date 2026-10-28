"use client";

import { useState } from "react";
import { CalendarDays, Clock, ExternalLink, MapPin, Trash2, Users, Video } from "lucide-react";
import { graph, type CalEvent, type Calendar } from "@/lib/graph";
import { Button, Dialog, Sheet, useToast } from "@/components/ui";
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
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function remove() {
    if (!event) return;
    setBusy(true);
    try {
      await graph.deleteEvent(event.id);
      toast("Termin gelöscht");
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
          {event.location && <Row icon={MapPin}>{event.location}</Row>}
          {event.joinUrl && (
            <a
              href={event.joinUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex h-10 w-fit items-center gap-2 rounded-full bg-snow px-4 font-medium text-sky hover:opacity-90"
            >
              <Video className="h-4 w-4" /> An Teams-Besprechung teilnehmen
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
            {calendar?.canEdit && (
              <Button variant="ghost" className="text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>
                Löschen
              </Button>
            )}
          </div>
        </div>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Termin löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy} loadingText="Wird gelöscht …" onClick={remove}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          „{event?.subject}“ wird aus dem Kalender von hello@ entfernt. Eingeladene Personen bekommen keine Absage.
        </p>
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
