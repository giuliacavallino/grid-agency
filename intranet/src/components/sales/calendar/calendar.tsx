"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCog, CalendarPlus, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { CALENDAR_SCOPES, DOMAIN } from "@/lib/config";
import { ConsentRequiredError } from "@/lib/auth";
import { useResource } from "@/lib/data";
import { graphFor, useAsync, type CalEvent, type Calendar } from "@/lib/graph";
import type { Customer, Lead } from "@/lib/sales/types";
import { useCan, useMe } from "@/components/access";
import { Popover, Spinner } from "@/components/ui";
import { GraphProblem } from "../mail/access";
import { rangeFor, shortTitle, startOfDay, step, today as getToday, type View } from "./dates";
import { EventDialog } from "./event-dialog";
import { EventSheet } from "./event-sheet";
import { ListView } from "./list-view";
import { MonthView } from "./month-view";
import { TimeGrid } from "./time-grid";

const VIEWS: { id: View; label: string }[] = [
  { id: "day", label: "Tag" },
  { id: "week", label: "Woche" },
  { id: "month", label: "Monat" },
  { id: "list", label: "Liste" },
];

/** Termine nach Gegenüber: Kunden, Leads, sonst extern, nur Team oder ohne Gäste */
const CATEGORIES = [
  { id: "kunden", label: "Kunden", color: "#4f9a7a" },
  { id: "leads", label: "Leads", color: "#4f7fd9" },
  { id: "extern", label: "Extern", color: "#f29c38" },
  { id: "intern", label: "Intern", color: "#9b7fd9" },
  { id: "eigene", label: "Eigene", color: "#8b8680" },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

// Freemail-Domains zählen nicht als Firma eines Kunden
const FREEMAIL = new Set(["gmail.com", "googlemail.com", "web.de", "gmx.de", "gmx.net", "t-online.de", "outlook.com", "hotmail.com", "icloud.com", "me.com", "yahoo.com", "yahoo.de"]);
const domainOf = (address: string) => address.split("@")[1] ?? "";

/** Kalender aller Postfächer eines Bereichs: Kategorien oben, Raster als Karte. */
export function CalendarApp({ mailboxes }: { mailboxes: string[] }) {
  const me = useMe();
  const canSales = useCan("sales");
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(getToday);
  const [today] = useState(getToday);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(new Set());
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());
  const [openEvent, setOpenEvent] = useState<CalEvent | null>(null);
  const [createAt, setCreateAt] = useState<{ start: Date; end?: Date } | null>(null);

  useEffect(() => {
    // Auf dem Handy passt die Woche nicht: mit der Tagesansicht starten
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Bildschirmbreite gibt es erst im Browser
    if (window.matchMedia("(max-width: 767px)").matches) setView("day");
    // ?neu=1 (z. B. aus dem Posteingang) öffnet direkt einen neuen Termin
    if (new URLSearchParams(window.location.search).get("neu")) setCreateAt({ start: nextSlot(getToday()) });
  }, []);

  // Kalender aller Postfächer; ein Postfach ohne Zugriff fällt einfach weg
  const loaded = useAsync(`calendars:${mailboxes.join()}`, async () => {
    const results = await Promise.allSettled(mailboxes.map((m) => graphFor(m).calendars()));
    const failed = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    // Ohne Zustimmung oder ganz ohne Zugriff den Fehler zeigen
    const consent = failed.find((e) => e instanceof ConsentRequiredError);
    if (consent || failed.length === results.length) throw consent ?? failed[0];
    return {
      list: results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
      denied: mailboxes.filter((_, i) => results[i].status === "rejected"),
    };
  });
  const calendars = loaded.data?.list;
  const { start, end } = rangeFor(view, anchor);
  const ids = calendars?.map((c) => c.id).join(",") ?? "";
  const events = useAsync(!calendars ? null : `events:${start.toISOString()}:${end.toISOString()}:${ids}`, async () => {
    const lists = await Promise.all(calendars!.map((c) => graphFor(c.mailbox).events(c, start, end)));
    return lists.flat();
  });

  // Kunden und Leads (nur mit Sales-Zugriff) für die Einordnung der Termine
  const customers = useResource<Customer[]>(canSales ? "/api/sales/customers" : null);
  const leads = useResource<Lead[]>(canSales ? "/api/sales/leads" : null);
  const categoryOf = useMemo(() => {
    const own = new Set([...mailboxes, me.data?.email ?? ""].map((a) => a.toLowerCase()));
    const customerMails = new Set<string>();
    const customerDomains = new Set<string>();
    for (const c of customers.data ?? []) {
      for (const mail of [c.email, c.billing_email]) {
        if (!mail) continue;
        customerMails.add(mail.toLowerCase());
        const domain = domainOf(mail.toLowerCase());
        if (domain && !FREEMAIL.has(domain) && domain !== DOMAIN) customerDomains.add(domain);
      }
    }
    const leadMails = new Set((leads.data ?? []).flatMap((l) => (l.email ? [l.email.toLowerCase()] : [])));
    return (event: CalEvent): Category => {
      const others = event.attendees.map((a) => a.address?.toLowerCase()).filter((a): a is string => !!a && !own.has(a));
      if (!others.length) return "eigene";
      if (others.some((a) => customerMails.has(a) || customerDomains.has(domainOf(a)))) return "kunden";
      if (others.some((a) => leadMails.has(a))) return "leads";
      if (others.every((a) => domainOf(a) === DOMAIN)) return "intern";
      return "extern";
    };
  }, [customers.data, leads.data, mailboxes, me.data?.email]);

  const calendarById = useMemo(() => new Map((calendars ?? []).map((c) => [c.id, c])), [calendars]);
  const inCalendars = useMemo(() => (events.data ?? []).filter((e) => !hiddenCalendars.has(e.calendarId)), [events.data, hiddenCalendars]);
  const counts = useMemo(() => {
    const result = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<Category, number>;
    for (const e of inCalendars) result[categoryOf(e)]++;
    return result;
  }, [inCalendars, categoryOf]);
  const visible = useMemo(() => inCalendars.filter((e) => !hiddenCategories.has(categoryOf(e))), [inCalendars, hiddenCategories, categoryOf]);
  const colorOf = (event: CalEvent) => CATEGORIES.find((c) => c.id === categoryOf(event))!.color;

  function go(date: Date, nextView: View = view) {
    setAnchor(startOfDay(date));
    setView(nextView);
  }

  // Tastatur: t = heute, Pfeile blättern
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

  const problem = loaded.error ?? events.error;
  const pill = "flex items-center rounded-full border border-snow/[0.08] bg-surface p-1 shadow-[0_2px_10px_var(--shadow-color)]";

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Kategorien und Werkzeuge */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2.5 px-3 pt-5 pb-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => {
            const off = hiddenCategories.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setHiddenCategories((set) => {
                    const next = new Set(set);
                    if (off) next.delete(c.id);
                    else next.add(c.id);
                    return next;
                  })
                }
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full border border-snow/[0.08] bg-surface px-3.5 text-[13.5px] font-medium shadow-[0_2px_10px_var(--shadow-color)] transition-opacity",
                  off && "opacity-45"
                )}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                {c.label}
                <span className="text-[12px] text-snow/45 tabular-nums">{counts[c.id]}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Ansicht" className={pill}>
            {VIEWS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  "h-8 rounded-full px-3.5 text-[13.5px] font-medium transition-colors",
                  view === id ? "bg-snow text-sky shadow-[0_2px_8px_var(--shadow-color)]" : "text-snow/70 hover:text-snow"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Zurück" onClick={() => go(step(view, anchor, -1))} className="grid h-9 w-9 place-items-center rounded-full border border-snow/[0.08] bg-surface hover:bg-snow/[0.06]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-20 px-1.5 text-center text-[14px] font-semibold tabular-nums">{shortTitle(view, anchor)}</span>
            <button type="button" aria-label="Weiter" onClick={() => go(step(view, anchor, 1))} className="grid h-9 w-9 place-items-center rounded-full border border-snow/[0.08] bg-surface hover:bg-snow/[0.06]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={() => go(getToday())} className="h-9 rounded-full border border-snow/[0.08] bg-surface px-3.5 text-[13.5px] font-medium hover:bg-snow/[0.06]">
            Heute
          </button>
          <button
            type="button"
            aria-label="Neu laden"
            title="Neu laden"
            onClick={() => events.reload()}
            className="grid h-9 w-9 place-items-center rounded-full text-snow/65 hover:bg-snow/[0.06] hover:text-snow"
          >
            {events.loading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <Popover
            align="right"
            trigger={({ toggle, open }) => (
              <button type="button" aria-label="Kalender auswählen" title="Kalender auswählen" aria-expanded={open} onClick={toggle} className="grid h-9 w-9 place-items-center rounded-full text-snow/65 hover:bg-snow/[0.06] hover:text-snow">
                <CalendarCog className="h-4 w-4" />
              </button>
            )}
          >
            {() => (
              <CalendarPicker
                mailboxes={mailboxes}
                calendars={calendars ?? []}
                denied={loaded.data?.denied ?? []}
                hidden={hiddenCalendars}
                onToggle={(id) =>
                  setHiddenCalendars((set) => {
                    const next = new Set(set);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />
            )}
          </Popover>
          <button
            type="button"
            onClick={() => setCreateAt({ start: nextSlot(view === "day" ? anchor : getToday()) })}
            className="flex h-10 items-center gap-2 rounded-full bg-snow px-4 text-[14px] font-medium text-sky shadow-[0_6px_18px_var(--shadow-color)] hover:opacity-90"
          >
            <CalendarPlus className="h-4 w-4" /> Neuer Termin
          </button>
        </div>
      </div>

      <main className="min-h-0 flex-1 px-2 pb-3 md:px-6 md:pb-6">
        <div className="h-full overflow-hidden rounded-3xl border border-snow/[0.06] bg-surface shadow-[0_10px_40px_var(--shadow-color)]">
          {problem ? (
            <GraphProblem
              error={problem}
              scopes={CALENDAR_SCOPES}
              onRetry={() => {
                loaded.reload();
                events.reload();
              }}
            />
          ) : !calendars ? (
            <div className="grid h-full place-items-center">
              <Spinner />
            </div>
          ) : view === "list" ? (
            <ListView start={start} days={28} today={today} events={visible} colorOf={colorOf} onOpen={setOpenEvent} />
          ) : view === "month" ? (
            <MonthView
              anchor={anchor}
              today={today}
              events={visible}
              colorOf={colorOf}
              onOpen={setOpenEvent}
              onDay={(d) => go(d, "day")}
              onCreate={(d) => setCreateAt({ start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9) })}
            />
          ) : (
            <TimeGrid
              start={start}
              days={view === "day" ? 1 : 7}
              today={today}
              events={visible}
              colorOf={colorOf}
              onOpen={setOpenEvent}
              onCreate={(start, end) => setCreateAt({ start, end })}
              onDay={(d) => go(d, "day")}
            />
          )}
        </div>
      </main>

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
        start={createAt?.start ?? null}
        end={createAt?.end}
        calendars={calendars ?? []}
        onClose={() => setCreateAt(null)}
        onCreated={() => {
          setCreateAt(null);
          events.reload();
        }}
      />
    </div>
  );
}

function CalendarPicker({
  mailboxes,
  calendars,
  denied,
  hidden,
  onToggle,
}: {
  mailboxes: string[];
  calendars: Calendar[];
  denied: string[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="max-h-96 w-72 overflow-y-auto p-3">
      {mailboxes.map((address) => (
        <div key={address} className="mb-3 last:mb-0">
          <p className="mb-1.5 truncate text-[11px] font-medium tracking-wide text-snow/45 uppercase" title={address}>
            {address}
          </p>
          {denied.includes(address) ? (
            <p className="text-[12px] text-snow/45">Kein Zugriff auf diesen Kalender</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {calendars
                .filter((c) => c.mailbox === address)
                .map((c) => {
                  const on = !hidden.has(c.id);
                  return (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 text-[13.5px] hover:bg-snow/[0.05]">
                        <input type="checkbox" checked={on} onChange={() => onToggle(c.id)} className="sr-only" />
                        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border-2" style={{ borderColor: c.color, background: on ? c.color : "transparent" }} aria-hidden>
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
      ))}
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
