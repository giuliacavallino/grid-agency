"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, PanelLeft, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { CALENDAR_SCOPES } from "@/lib/config";
import { graph, useAsync, type CalEvent } from "@/lib/graph";
import { Button, IconButton, Spinner } from "@/components/ui";
import { GraphProblem } from "../mail/access";
import { addMonths, rangeFor, startOfDay, step, titleFor, today as getToday, type View } from "./dates";
import { EventDialog } from "./event-dialog";
import { EventSheet } from "./event-sheet";
import { MiniMonth } from "./mini-month";
import { MonthView } from "./month-view";
import { TimeGrid } from "./time-grid";
import { YearView } from "./year-view";

const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Tag" },
  { id: "week", label: "Woche" },
  { id: "month", label: "Monat" },
  { id: "year", label: "Jahr" },
];

/** Kalender von hello@ im Stil von Apple Kalender. */
export function CalendarApp() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(getToday);
  const [today] = useState(getToday);
  const [miniMonth, setMiniMonth] = useState(getToday);
  const [sidebar, setSidebar] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [openEvent, setOpenEvent] = useState<CalEvent | null>(null);
  const [createAt, setCreateAt] = useState<Date | null>(null);

  // Auf dem Handy passt die Woche nicht: mit der Tagesansicht starten
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Bildschirmbreite gibt es erst im Browser
    if (window.matchMedia("(max-width: 767px)").matches) setView("day");
  }, []);

  const calendars = useAsync("calendars", () => graph.calendars());
  const { start, end } = rangeFor(view, anchor);
  const ids = calendars.data?.map((c) => c.id).join(",") ?? "";
  const events = useAsync(view === "year" || !calendars.data ? null : `events:${start.toISOString()}:${end.toISOString()}:${ids}`, async () => {
    const lists = await Promise.all(calendars.data!.map((c) => graph.events(c, start, end)));
    return lists.flat();
  });

  const calendarById = useMemo(() => new Map((calendars.data ?? []).map((c) => [c.id, c])), [calendars.data]);
  const visible = useMemo(() => (events.data ?? []).filter((e) => !hidden.has(e.calendarId)), [events.data, hidden]);
  const colorOf = (event: CalEvent) => calendarById.get(event.calendarId)?.color ?? "#4f9bf0";

  function go(date: Date, nextView: View = view) {
    setAnchor(startOfDay(date));
    setMiniMonth(startOfDay(date));
    setView(nextView);
  }

  // Tastatur wie in Apple Kalender: t = heute, Pfeile blättern
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]") || document.querySelector('[role="dialog"]')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "t") go(getToday());
      else if (event.key === "ArrowLeft") go(step(view, anchor, -1));
      else if (event.key === "ArrowRight") go(step(view, anchor, 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [boldTitle, lightTitle] = titleFor(view, anchor);
  const problem = calendars.error ?? events.error;

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Werkzeugleiste */}
      <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-snow/[0.08] bg-sky px-3 py-2 md:px-4">
        <IconButton label="Seitenleiste ein-/ausblenden" onClick={() => setSidebar((s) => !s)} className="hidden md:inline-flex">
          <PanelLeft className="h-4 w-4" />
        </IconButton>
        <h1 className="min-w-0 truncate text-[22px] leading-none tracking-tight md:text-[26px]">
          <span className="font-semibold">{boldTitle}</span>
          {lightTitle && <span className="font-light text-snow/70"> {lightTitle}</span>}
        </h1>
        {events.loading && <Spinner className="h-4 w-4" />}

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <div role="tablist" aria-label="Ansicht" className="flex rounded-[9px] bg-snow/[0.08] p-0.5">
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "h-7 rounded-[7px] px-2 text-[13px] transition-colors sm:px-3.5",
                  view === id ? "bg-surface font-medium text-snow shadow-[0_1px_3px_var(--shadow-color)]" : "text-snow/65 hover:text-snow"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <IconButton label="Neuer Termin" onClick={() => setCreateAt(nextSlot(anchor))}>
            <Plus className="h-4 w-4" />
          </IconButton>
          <div className="flex items-center">
            <IconButton label="Zurück" onClick={() => go(step(view, anchor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <Button variant="ghost" size="sm" className="px-2.5" onClick={() => go(getToday())}>
              Heute
            </Button>
            <IconButton label="Weiter" onClick={() => go(step(view, anchor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {sidebar && (
          <aside className="hidden w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-snow/[0.08] bg-sky p-4 md:flex">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">
                  {miniMonth.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
                </span>
                <span className="flex">
                  <IconButton label="Vorheriger Monat" className="h-6 w-6" onClick={() => setMiniMonth((m) => addMonths(m, -1))}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Nächster Monat" className="h-6 w-6" onClick={() => setMiniMonth((m) => addMonths(m, 1))}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </IconButton>
                </span>
              </div>
              <MiniMonth month={miniMonth} today={today} selected={anchor} onSelect={(day) => go(day, view === "year" ? "day" : view)} compact />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-medium tracking-wide text-snow/45 uppercase">hello@grid-agency.de</p>
              {calendars.loading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <ul className="flex flex-col gap-1">
                  {calendars.data?.map((c) => {
                    const on = !hidden.has(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-[13.5px] hover:bg-snow/[0.05]">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setHidden((set) => {
                                const next = new Set(set);
                                if (on) next.add(c.id);
                                else next.delete(c.id);
                                return next;
                              })
                            }
                            className="sr-only"
                          />
                          <span
                            className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border-2"
                            style={{ borderColor: c.color, background: on ? c.color : "transparent" }}
                            aria-hidden
                          >
                            {on && (
                              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white">
                                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className="truncate">{c.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-auto">
          {problem ? (
            <GraphProblem
              error={problem}
              scopes={CALENDAR_SCOPES}
              onRetry={() => {
                calendars.reload();
                events.reload();
              }}
            />
          ) : view === "year" ? (
            <YearView year={anchor.getFullYear()} today={today} onMonth={(m) => go(m, "month")} onDay={(d) => go(d, "day")} />
          ) : view === "month" ? (
            <MonthView
              anchor={anchor}
              today={today}
              events={visible}
              colorOf={colorOf}
              onOpen={setOpenEvent}
              onDay={(d) => go(d, "day")}
              onCreate={(d) => setCreateAt(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))}
            />
          ) : (
            <TimeGrid
              start={start}
              days={view === "day" ? 1 : 7}
              today={today}
              events={visible}
              colorOf={colorOf}
              onOpen={setOpenEvent}
              onCreate={setCreateAt}
              onDay={(d) => go(d, "day")}
            />
          )}
        </main>
      </div>

      <EventSheet
        event={openEvent}
        calendar={openEvent ? calendarById.get(openEvent.calendarId) : undefined}
        onClose={() => setOpenEvent(null)}
        onDeleted={() => {
          setOpenEvent(null);
          events.reload();
        }}
      />
      <EventDialog
        start={createAt}
        calendars={calendars.data ?? []}
        onClose={() => setCreateAt(null)}
        onCreated={() => {
          setCreateAt(null);
          events.reload();
        }}
      />
    </div>
  );
}

/** Nächste volle Stunde am gewählten Tag (heute: ab jetzt, sonst 9 Uhr) */
function nextSlot(day: Date) {
  const now = new Date();
  const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9);
  if (slot.toDateString() === now.toDateString() && now.getHours() >= 9) slot.setHours(Math.min(now.getHours() + 1, 23));
  return slot;
}
