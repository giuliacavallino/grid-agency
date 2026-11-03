"use client";

import { useEffect, useState } from "react";
import { Clock, LoaderCircle, Play, Square, Trash2 } from "lucide-react";
import { useCan } from "@/components/access";
import { CustomerPicker } from "@/components/customer-picker";
import { Button, IconButton, Input, Popover, Spinner, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { mutate, revalidate, useResource } from "@/lib/data";
import { berlinDate, TZ } from "@/lib/jourfix";
import type { Customer } from "@/lib/sales/types";

// Zeiterfassung in der Kopfleiste: Timer starten und stoppen, heutige
// Einträge und Summen für heute und diese Woche.

type TimeEntry = {
  id: string;
  started_at: string;
  ended_at: string | null;
  customer_id: string | null;
  task_id: string | null;
  note: string;
  customer_name: string | null;
};

type TimeData = { entries: TimeEntry[]; running: TimeEntry | null };

const URL = "/api/zeit";
const NOTE_MAX = 300;

const pad = (n: number) => String(n).padStart(2, "0");

/** Sekunden → „01:05:09“ */
function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
}

/** Millisekunden → „1 h 5 min“ bzw. „45 min“ */
function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}

const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const time = (iso: string) => timeFormat.format(new Date(iso));

const length = (entry: TimeEntry, now: number) =>
  (entry.ended_at ? Date.parse(entry.ended_at) : now) - Date.parse(entry.started_at);

/** Aktuelle Zeit, sekündlich solange active */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const message = (error: unknown) => (error instanceof Error ? error.message : "Das hat nicht geklappt.");

/** Zeit-Button für die Kopfleiste mit Popover zur Zeiterfassung */
export function TimeButton() {
  const auth = useAuth();
  const { data } = useResource<TimeData>(auth.status === "signed-in" ? URL : null);
  const running = data?.running ?? null;
  const now = useNow(!!running);
  const elapsed = running ? clock(now - Date.parse(running.started_at)) : null;

  return (
    <Popover
      className="w-[min(340px,calc(100vw-2rem))] p-3"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={elapsed ? `Zeiterfassung, Timer läuft: ${elapsed}` : "Zeiterfassung"}
          className="flex h-10 items-center gap-2 rounded-full border border-snow/[0.08] bg-surface px-3.5 text-[14px] font-medium text-snow shadow-[0_2px_10px_var(--shadow-color)] transition-colors hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow"
        >
          <Clock className="h-4 w-4 text-snow/70" aria-hidden />
          {running ? (
            <>
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
              </span>
              <span className="tabular-nums">{elapsed}</span>
            </>
          ) : (
            <span>Zeit</span>
          )}
        </button>
      )}
    >
      {() => <TimePanel data={data} />}
    </Popover>
  );
}

function TimePanel({ data }: { data: TimeData | undefined }) {
  // Eigene Uhr, solange das Popover offen ist (Summen, „heute“ nach Mitternacht)
  const now = useNow(true);
  if (!data) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  const { entries, running } = data;
  const today = berlinDate(now);
  const all = running && !entries.some((e) => e.id === running.id) ? [running, ...entries] : entries;
  const todays = all.filter((e) => berlinDate(Date.parse(e.started_at)) === today);
  const sum = (list: TimeEntry[]) => list.reduce((total, e) => total + length(e, now), 0);

  return (
    <div className="flex flex-col gap-3">
      {running ? <Running entry={running} now={now} /> : <StartForm />}

      <div className="border-t border-snow/10 pt-3">
        <h3 className="px-1 text-xs font-medium text-snow/60">Heute</h3>
        {todays.filter((e) => e.id !== running?.id).length ? (
          <ul className="mt-1.5 flex max-h-64 flex-col overflow-y-auto">
            {todays
              .filter((e) => e.id !== running?.id)
              .map((entry) => (
                <EntryRow key={entry.id} entry={entry} now={now} />
              ))}
          </ul>
        ) : (
          <p className="px-1 py-3 text-sm text-snow/45">Noch nichts erfasst.</p>
        )}
      </div>

      <p className="border-t border-snow/10 px-1 pt-3 text-xs text-snow/60 tabular-nums">
        Heute {duration(sum(todays))} · Diese Woche {duration(sum(all))}
      </p>
    </div>
  );
}

function Running({ entry, now }: { entry: TimeEntry; now: number }) {
  const toast = useToast();
  const [stopping, setStopping] = useState(false);

  async function stop() {
    setStopping(true);
    try {
      const stopped = await api<TimeEntry>(`${URL}/${entry.id}`, { method: "PATCH", body: JSON.stringify({ stop: true }) });
      mutate<TimeData>(URL, (d) => ({
        running: null,
        entries: d.entries.some((e) => e.id === stopped.id)
          ? d.entries.map((e) => (e.id === stopped.id ? stopped : e))
          : [stopped, ...d.entries],
      }));
      revalidate(URL);
    } catch (error) {
      toast(message(error), "error");
    } finally {
      setStopping(false);
    }
  }

  const title = entry.customer_name || entry.note || "Ohne Kunde";
  return (
    <div className="flex flex-col gap-3 px-1 pt-1">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {entry.customer_name && entry.note && <p className="truncate text-xs text-snow/55">{entry.note}</p>}
        <p className="text-xs text-snow/45">seit {time(entry.started_at)} Uhr</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xl font-medium tabular-nums">{clock(now - Date.parse(entry.started_at))}</span>
        <Button variant="primary" onClick={stop} loading={stopping} loadingText="Wird gestoppt…" icon={<Square className="h-3.5 w-3.5" />}>
          Stopp
        </Button>
      </div>
    </div>
  );
}

function StartForm() {
  const toast = useToast();
  const canSales = useCan("sales");
  const { data: customers } = useResource<Customer[]>(canSales ? "/api/sales/customers" : null);
  const [customerId, setCustomerId] = useState("");
  const [note, setNote] = useState("");
  const [starting, setStarting] = useState(false);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setStarting(true);
    try {
      const entry = await api<TimeEntry>(URL, {
        method: "POST",
        body: JSON.stringify({ customer_id: customerId || null, note: note.trim() }),
      });
      mutate<TimeData>(URL, (d) => ({ running: entry, entries: [entry, ...d.entries] }));
      revalidate(URL);
      setNote("");
    } catch (error) {
      toast(message(error), "error");
    } finally {
      setStarting(false);
    }
  }

  const active = (customers ?? []).filter((c) => c.status !== "ehemalig" || c.id === customerId);
  return (
    <form onSubmit={start} className="flex flex-col gap-2">
      {canSales && (
        <CustomerPicker value={customerId} onChange={setCustomerId} customers={active} text={note} />
      )}
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NOTE_MAX}
        placeholder="Woran arbeitest du?"
        aria-label="Notiz"
      />
      <Button
        type="submit"
        variant="primary"
        loading={starting}
        loadingText="Wird gestartet…"
        icon={<Play className="h-3.5 w-3.5" />}
      >
        Start
      </Button>
    </form>
  );
}

function EntryRow({ entry, now }: { entry: TimeEntry; now: number }) {
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await api(`${URL}/${entry.id}`, { method: "DELETE" });
      mutate<TimeData>(URL, (d) => ({ ...d, entries: d.entries.filter((e) => e.id !== entry.id) }));
    } catch (error) {
      toast(message(error), "error");
      setDeleting(false);
    }
  }

  const label = [entry.customer_name, entry.note].filter(Boolean).join(" · ") || "Ohne Kunde";
  return (
    <li className={cn("group flex items-center gap-2 rounded-xl px-1 py-1.5", deleting && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        <p className="text-xs text-snow/50 tabular-nums">
          {time(entry.started_at)}–{entry.ended_at ? time(entry.ended_at) : "jetzt"} · {duration(length(entry, now))}
        </p>
      </div>
      <IconButton label="Eintrag löschen" onClick={remove} disabled={deleting} aria-busy={deleting || undefined}>
        {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" />}
      </IconButton>
    </li>
  );
}
