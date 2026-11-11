"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";
import { Archive, CalendarClock, Check, ChevronDown, LayoutGrid, MailCheck, Package, PhoneCall, Plus, RotateCcw, Search, Table, type LucideIcon } from "lucide-react";
import { useMe, useTeam } from "@/components/access";
import { PersonAvatar } from "@/components/person";
import { api } from "@/lib/api";
import { revalidate, updateRow, useResource, useRows } from "@/lib/data";
import { euro, formatDate } from "@/lib/format";
import { accentFill, accentText } from "@/lib/theme";
import { SOURCES, STAGES, topPosition, type Lead, type Stage } from "@/lib/sales/types";
import { Button, Empty, Popover, Spinner, useToast } from "@/components/ui";
import { SOURCE_STYLE, sourceLabel } from "./source";
import { LeadSheet, NewLeadDialog } from "./lead-sheet";
import { LeadActions } from "./lead-actions";

type Columns = Record<Stage, string[]>;

// Akzent je Phase: von gedämpft (neu) zu Aurora-Gold (gewonnen)
export const STAGE_COLOR: Record<Stage, string> = {
  neu: "#afaaa0",
  erstgespraech: "#b58cf0",
  angebot: "#fa9e4e",
  gewonnen: "#9fd8a8",
};

/** Abschlusswahrscheinlichkeit je Phase für „gewichtet“ (Pipeline, Auftragsbuch). */
export const STAGE_PROBABILITY: Record<Stage, number> = {
  neu: 0.1,
  erstgespraech: 0.3,
  angebot: 0.6,
  gewonnen: 1,
};

/** Gewichteter Monatswert offener Leads (ohne „Kunde gewonnen“, die zählen als Retainer). */
export const weightedValue = (leads: Lead[]) =>
  leads.filter((lead) => lead.stage !== "gewonnen").reduce((sum, lead) => sum + (lead.value ?? 0) * STAGE_PROBABILITY[lead.stage], 0);

// ---------- Bausteine im Meinberg-Stil (auch für Personal und Auftragsbuch) ----------

/** Pillenform der Bedienelemente */
export const PILL = "rounded-full border border-snow/[0.08] bg-surface shadow-[0_2px_10px_var(--shadow-color)]";

export type SegmentOption<T extends string> = { id: T; label: string; icon?: LucideIcon };

/** Segmentierter Umschalter: aktives Segment dunkel */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={clsx(PILL, "inline-flex h-10 shrink-0 items-center gap-0.5 p-1", className)}>
      {options.map(({ id, label: text, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={clsx(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-medium whitespace-nowrap transition-colors",
            value === id ? "bg-snow text-sky shadow-[0_2px_8px_var(--shadow-color)]" : "text-snow/60 hover:text-snow"
          )}
        >
          {Icon && <Icon className="h-4 w-4" strokeWidth={1.9} />}
          {text}
        </button>
      ))}
    </div>
  );
}

export function SearchPill({
  value,
  onChange,
  label,
  placeholder = "Suchen …",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={clsx(PILL, "flex h-10 min-w-0 items-center gap-2 px-4 focus-within:border-snow/25", className)}>
      <Search className="h-4 w-4 shrink-0 text-snow/40" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-snow outline-none placeholder:text-snow/40 [&::-webkit-search-cancel-button]:hidden"
      />
    </label>
  );
}

/** Chip der Schnellansicht; ein zweiter Klick hebt die Auswahl auf */
export function QuickChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
        active
          ? "border-snow bg-snow text-sky shadow-[0_2px_10px_var(--shadow-color)]"
          : "border-snow/[0.08] bg-surface text-snow/70 shadow-[0_2px_10px_var(--shadow-color)] hover:text-snow"
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={clsx(
            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-sky/20 text-sky" : "bg-snow/[0.07] text-snow/55"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export const QUICK_VIEWS = [
  { id: "meine", label: "Meine" },
  { id: "neu", label: "Neu" },
  { id: "woche", label: "Diese Woche" },
  { id: "ohne", label: "Ohne Zuständigkeit" },
] as const;
export type QuickView = (typeof QUICK_VIEWS)[number]["id"];

/** Label „Schnellansicht“ und die vier Chips mit Zähler */
export function QuickViews({
  value,
  onChange,
  counts,
}: {
  value: QuickView | null;
  onChange: (value: QuickView | null) => void;
  counts: Record<QuickView, number>;
}) {
  return (
    <>
      <span className="ml-1 hidden shrink-0 text-[13px] text-snow/45 lg:inline">Schnellansicht</span>
      {QUICK_VIEWS.map((view) => (
        <QuickChip key={view.id} active={value === view.id} onClick={() => onChange(value === view.id ? null : view.id)} count={counts[view.id]}>
          {view.label}
        </QuickChip>
      ))}
    </>
  );
}

/** „Filter ▾“ ganz rechts in der zweiten Zeile; der Inhalt kommt vom Aufrufer */
export function FilterPill({ active, children }: { active: number; children: (close: () => void) => React.ReactNode }) {
  return (
    <Popover
      className="w-64"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={clsx(PILL, "inline-flex h-10 shrink-0 items-center gap-1.5 px-4 text-[13.5px] font-medium text-snow/75 hover:text-snow")}
        >
          Filter
          {active > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-snow px-1.5 text-[11px] font-semibold text-sky tabular-nums">{active}</span>
          )}
          <ChevronDown className={clsx("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {children}
    </Popover>
  );
}

/** Zweite Zeile: Suche und Chips (waagerecht scrollbar), „Filter ▾“ fest rechts */
export function FilterBar({ filter, children }: { filter?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative z-20 flex shrink-0 items-center gap-2 px-4 py-2 md:px-6">
      <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-2">{children}</div>
      {filter}
    </div>
  );
}

/** Auswahlzeile im Filter-Popover */
export function FilterOption({ selected, onClick, color, children }: { selected: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-snow/85 hover:bg-snow/[0.08] hover:text-snow"
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {color ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> : null}
      </span>
      <span className="flex-1 truncate">{children}</span>
      {selected && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}

/** Spalte als hohe weiße Karte (Pipeline und Bewerber-Pipeline) */
export const COLUMN_CLASS =
  "flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-3xl border border-snow/[0.07] bg-surface shadow-[0_4px_18px_var(--shadow-color)] transition-[box-shadow,border-color] md:w-auto md:max-w-none md:min-w-[228px] md:flex-1";
export const COLUMN_OVER_CLASS = "border-snow/25 shadow-[0_8px_28px_var(--shadow-strong)]";

export function ColumnHeader({
  color,
  label,
  count,
  extra,
  onAdd,
  addLabel,
}: {
  color: string;
  label: string;
  count: number;
  extra?: React.ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <header className="flex h-[52px] shrink-0 items-center gap-2 px-4 pt-1">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <h2 className="truncate text-[14.5px] font-semibold">{label}</h2>
      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-snow/[0.07] px-1.5 text-[11px] font-semibold text-snow/55 tabular-nums">{count}</span>
      <span className="ml-auto truncate text-[12px] text-snow/45 tabular-nums">{extra}</span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel ?? "Hinzufügen"}
          title={addLabel}
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-snow/50 hover:bg-snow/10 hover:text-snow"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </header>
  );
}

/** Leere Spalte: mittiges „–“ (bleibt Ablagefläche) */
export function EmptyColumn() {
  return (
    <li aria-label="Keine Einträge" className="flex min-h-24 flex-1 items-center justify-center text-[22px] text-snow/35 select-none">
      –
    </li>
  );
}

/** Kartenrahmen: weiß, rund, linker Rand in der Phasenfarbe */
export function cardClass(overlay?: boolean) {
  return clsx(
    "cursor-grab rounded-2xl border border-l-[3px] border-snow/[0.08] bg-surface p-3.5 shadow-[0_1px_4px_var(--shadow-color)] transition-[border-color,box-shadow] select-none hover:shadow-[0_4px_14px_var(--shadow-color)] active:cursor-grabbing",
    overlay && "rotate-[1.5deg] shadow-[0_18px_40px_var(--shadow-strong)]"
  );
}

/** Tabellen- und Archivansicht als große weiße Karte */
export const PANEL_CLASS = "overflow-hidden rounded-3xl border border-snow/[0.07] bg-surface shadow-[0_4px_18px_var(--shadow-color)]";

/** „vor 8 Tagen“ (ausgeschrieben, für Karten) */
export function since(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime();
  const plural = (n: number, one: string, many: string) => `vor ${n} ${n === 1 ? one : many}`;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return plural(minutes, "Minute", "Minuten");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return plural(hours, "Stunde", "Stunden");
  const days = Math.round(hours / 24);
  if (days < 30) return plural(days, "Tag", "Tagen");
  const months = Math.round(days / 30);
  if (months < 12) return plural(months, "Monat", "Monaten");
  return plural(Math.round(months / 12), "Jahr", "Jahren");
}

/** Montag 0:00 der laufenden Woche */
export function startOfWeek(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Zuständige Person: E-Mail oder Name, aufgelöst über das Team */
export function useOwnerMatch() {
  const me = useMe().data;
  const team = useTeam();
  return useMemo(() => {
    const find = (owner: string | null) => {
      if (!owner) return null;
      const key = owner.trim().toLowerCase();
      return team.find((m) => m.email.toLowerCase() === key || m.name.toLowerCase() === key) ?? null;
    };
    const isMine = (owner: string | null) => {
      if (!owner || !me) return false;
      const key = owner.trim().toLowerCase();
      return key === me.email.toLowerCase() || (!!me.name && key === me.name.toLowerCase());
    };
    return { find, isMine };
  }, [me, team]);
}

export function OwnerLine({ owner, time }: { owner: string | null; time: string }) {
  const { find } = useOwnerMatch();
  const member = find(owner);
  const name = member?.name ?? owner;
  return (
    <div className="flex items-center gap-2 text-[12px]">
      {name ? (
        <PersonAvatar name={name} email={member?.email} className="h-6 w-6 text-[10px]" />
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-snow/25" aria-hidden />
      )}
      <span className={clsx("min-w-0 flex-1 truncate", name ? "font-medium text-snow/80" : "text-snow/45")}>{name ?? "Nicht zugewiesen"}</span>
      <span className="shrink-0 text-snow/45">{time}</span>
    </div>
  );
}

// ---------- Pipeline ----------

/** Oben steht die höchste Position; neue Leads bekommen den aktuellen Zeitstempel. */
const byPosition = (a: Lead, b: Lead) => b.position - a.position;

function group(leads: Lead[]): Columns {
  const columns = Object.fromEntries(STAGES.map((s) => [s.id, [] as string[]])) as Columns;
  for (const lead of [...leads].sort(byPosition)) columns[lead.stage]?.push(lead.id);
  return columns;
}

function findColumn(columns: Columns, id: string): Stage | null {
  if (id in columns) return id as Stage;
  return (Object.keys(columns) as Stage[]).find((stage) => columns[stage].includes(id)) ?? null;
}

type View = "board" | "tabelle" | "archiv";
const VIEWS: readonly SegmentOption<View>[] = [
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "tabelle", label: "Tabelle", icon: Table },
  { id: "archiv", label: "Archiv", icon: Archive },
];

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<Stage, string>;

export function Pipeline() {
  const { data: leads, loading, error } = useRows<Lead>("leads", "status=offen");
  const toast = useToast();
  const owners = useOwnerMatch();
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [quick, setQuick] = useState<QuickView | null>(null);
  const [dragging, setDragging] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Geöffneter Lead steht in der URL (?lead=…), damit die Glocke ihn öffnet
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = params.get("lead");
  const setOpenId = (id: string | null) => router.replace(id ? `${pathname}?lead=${id}` : pathname, { scroll: false });
  const [due, setDue] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [endOfToday] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  });
  const [creating, setCreating] = useState(false);
  const [weekStart] = useState(() => startOfWeek().getTime());

  const byId = useMemo(() => new Map((leads ?? []).map((lead) => [lead.id, lead])), [leads]);

  // Suche und Quelle; die Schnellansicht filtert danach (Zähler beziehen sich hierauf)
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads ?? []).filter(
      (lead) =>
        (!source || lead.source === source) &&
        (!q || [lead.name, lead.company, lead.email, lead.message].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [leads, query, source]);

  const quickMatch = useMemo(
    () => ({
      meine: (lead: Lead) => owners.isMine(lead.owner),
      neu: (lead: Lead) => lead.stage === "neu" && !lead.invited_at,
      woche: (lead: Lead) => new Date(lead.created_at).getTime() >= weekStart,
      ohne: (lead: Lead) => !lead.owner,
    }),
    [owners, weekStart]
  );
  const counts = useMemo(
    () => Object.fromEntries(QUICK_VIEWS.map((v) => [v.id, searched.filter(quickMatch[v.id]).length])) as Record<QuickView, number>,
    [searched, quickMatch]
  );
  const isDue = (lead: Lead) => lead.stage !== "gewonnen" && !!lead.next_step_at && new Date(lead.next_step_at).getTime() <= endOfToday;
  const dueCount = searched.filter(isDue).length;
  const visible = useMemo(() => {
    const quickRows = quick ? searched.filter(quickMatch[quick]) : searched;
    return due ? quickRows.filter((lead) => lead.stage !== "gewonnen" && !!lead.next_step_at && new Date(lead.next_step_at).getTime() <= endOfToday) : quickRows;
  }, [searched, quick, quickMatch, due, endOfToday]);

  const base = useMemo(() => group(visible), [visible]);
  const columns = dragging ?? base;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragging(base);
  }

  // Beim Ziehen über eine andere Spalte die Karte live dorthin verschieben
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragging) return;
    const from = findColumn(dragging, String(active.id));
    const to = findColumn(dragging, String(over.id));
    if (!from || !to || from === to) return;
    setDragging((cols) => {
      if (!cols) return cols;
      const target = [...cols[to]];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex < 0 ? target.length : overIndex, 0, String(active.id));
      return { ...cols, [from]: cols[from].filter((id) => id !== active.id), [to]: target };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const cols = dragging;
    setActiveId(null);
    if (!over || !cols) return setDragging(null);

    const id = String(active.id);
    const stage = findColumn(cols, id);
    const overStage = findColumn(cols, String(over.id));
    if (!stage || !overStage) return setDragging(null);

    // Reihenfolge in der Zielspalte bestimmen
    const list = [...cols[stage]];
    const oldIndex = list.indexOf(id);
    const newIndex = String(over.id) in cols ? list.length - 1 : list.indexOf(String(over.id));
    list.splice(oldIndex, 1);
    list.splice(newIndex < 0 ? list.length : newIndex, 0, id);
    const index = list.indexOf(id);

    const above = byId.get(list[index - 1]);
    const below = byId.get(list[index + 1]);
    const position = above && below
      ? (above.position + below.position) / 2
      : above
        ? above.position - 60
        : below
          ? below.position + 60
          : topPosition();

    const lead = byId.get(id)!;
    if (lead.stage === stage && lead.position === position) return setDragging(null);
    if (lead.stage === stage && list.join() === base[stage].join()) return setDragging(null);

    const request = updateRow<Lead & { _customer?: { name: string } }>("leads", id, { stage, position });
    setDragging(null);
    try {
      const row = await request;
      if (row._customer) {
        toast(`Kunde „${row._customer.name}“ angelegt`);
        revalidate("/api/sales/customers");
      }
    } catch {
      toast("Verschieben fehlgeschlagen", "error");
    }
  }

  async function syncOffers() {
    setSyncing(true);
    try {
      const result = await api<{ mailboxes: Record<string, Record<string, number> | { error: string }> }>("/api/sales/sync/angebote", { method: "POST" });
      const counts = Object.values(result.mailboxes);
      const failed = counts.find((c): c is { error: string } => "error" in c);
      const sum = (key: string) => counts.reduce((n, c) => n + ("error" in c ? 0 : (c[key] ?? 0)), 0);
      if (failed) toast(failed.error, "error");
      else toast(`${sum("angebot")} Angebote, ${sum("nachfassen")} Nachfass-Mails übernommen`);
      revalidate("/api/sales/leads");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Abgleich fehlgeschlagen", "error");
    }
    setSyncing(false);
  }

  const openLeads = leads?.filter((lead) => lead.stage !== "gewonnen") ?? [];
  const weighted = weightedValue(openLeads);
  const activeLead = activeId ? byId.get(activeId) : null;

  return (
    <div className="flex h-full flex-col bg-sky">
      <h1 className="sr-only">Pipeline</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-1 md:px-6">
        <p className="text-[15px] text-snow/55" title="Gewichtet nach Phase: Neuer Lead 10 %, Erstgespräch 30 %, Angebot 60 %">
          <strong className="mr-1 text-[22px] font-semibold text-snow tabular-nums">{leads ? openLeads.length : "–"}</strong> offen ·{" "}
          {leads ? euro(weighted) : "–"} gewichtet im Monat
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Segmented label="Ansicht" value={view} onChange={setView} options={VIEWS} />
          <Button
            className="h-10 w-10 px-0 sm:w-auto sm:px-4"
            icon={<MailCheck className="h-4 w-4" />}
            loading={syncing}
            loadingText="Mails werden gelesen …"
            title="Gesendete Mails der letzten 14 Tage nach Angeboten durchsuchen (läuft sonst stündlich automatisch)"
            aria-label="Angebote aus Mails übernehmen"
            onClick={syncOffers}
          >
            <span className="hidden sm:inline">Angebote aus Mails</span>
          </Button>
          <Button
            variant="primary"
            className="h-10 w-10 px-0 shadow-[0_4px_14px_var(--shadow-color)] sm:w-auto sm:px-4"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
            aria-label="Neuer Lead"
          >
            <span className="hidden sm:inline">Neuer Lead</span>
          </Button>
        </div>
      </div>

      {view !== "archiv" && (
        <FilterBar filter={<SourceFilter value={source} onChange={setSource} />}>
          <SearchPill value={query} onChange={setQuery} label="Leads durchsuchen" className="w-56 shrink-0 lg:w-64" />
          <QuickViews value={quick} onChange={setQuick} counts={counts} />
          <QuickChip active={due} onClick={() => setDue((v) => !v)} count={dueCount}>
            <PhoneCall className="h-3.5 w-3.5" aria-hidden />
            Nachfassen
          </QuickChip>
        </FilterBar>
      )}

      {error ? (
        <Empty title="Pipeline konnte nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : view === "tabelle" ? (
        <LeadTable leads={visible} onOpen={setOpenId} />
      ) : view === "archiv" ? (
        <LeadArchive won={(leads ?? []).filter((lead) => lead.stage === "gewonnen")} onOpen={setOpenId} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragging(null);
            setActiveId(null);
          }}
        >
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:snap-none md:px-6 md:pb-6">
            {STAGES.map((stage) => {
              const ids = columns[stage.id];
              const items = ids.map((id) => byId.get(id)!).filter(Boolean);
              return (
                <Column
                  key={stage.id}
                  stage={stage.id}
                  label={stage.label}
                  leads={items}
                  onOpen={setOpenId}
                  onAdd={stage.id === "neu" ? () => setCreating(true) : undefined}
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
            {activeLead && <LeadCard lead={activeLead} overlay />}
          </DragOverlay>
        </DndContext>
      )}

      <LeadSheet id={openId} onClose={() => setOpenId(null)} />
      <NewLeadDialog open={creating} onClose={() => setCreating(false)} onCreated={(lead) => setOpenId(lead.id)} />
    </div>
  );
}

/** Quelle im Filter-Popover */
function SourceFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <FilterPill active={value ? 1 : 0}>
      {(close) => {
        const choose = (next: string) => () => {
          onChange(next);
          close();
        };
        return (
          <div>
            <p className="px-3 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-[0.08em] text-snow/45 uppercase">Quelle</p>
            <FilterOption selected={!value} onClick={choose("")}>
              Alle Quellen
            </FilterOption>
            {SOURCES.map((s) => (
              <FilterOption key={s.id} selected={value === s.id} color={SOURCE_STYLE[s.id].color} onClick={choose(s.id)}>
                {s.label}
              </FilterOption>
            ))}
          </div>
        );
      }}
    </FilterPill>
  );
}

function Column({
  stage,
  label,
  leads,
  onOpen,
  onAdd,
}: {
  stage: Stage;
  label: string;
  leads: Lead[];
  onOpen: (id: string) => void;
  onAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = leads.reduce((sum, lead) => sum + (lead.value ?? 0), 0);

  return (
    <section aria-label={label} className={clsx(COLUMN_CLASS, isOver && COLUMN_OVER_CLASS)}>
      <ColumnHeader
        color={STAGE_COLOR[stage]}
        label={label}
        count={leads.length}
        extra={total > 0 && `${euro(total)}/M`}
        onAdd={onAdd}
        addLabel="Lead hinzufügen"
      />
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
          {leads.map((lead) => (
            <SortableCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
          {leads.length === 0 && <EmptyColumn />}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ lead, onOpen }: { lead: Lead; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented) onOpen(lead.id);
      }}
    >
      <LeadCard lead={lead} />
    </li>
  );
}

/** Kleiner Chip mit Punkt, z. B. „• Website“ */
export function TagChip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex max-w-full shrink-0 items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11.5px] leading-4 font-medium"
      style={{ background: accentFill(color, 12), color: accentText(color) }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

/** Paket- bzw. Wertzeile der Karte */
function packageText(lead: Lead) {
  if (lead.value) return `${euro(lead.value)} / Monat${lead.budget ? ` · Budget ${lead.budget}` : ""}`;
  if (lead.budget) return `Budget ${lead.budget}`;
  return null;
}

// Aktionsleiste (lead-actions.tsx) im Kartenstil: runder roter ✕-Button
// zuerst, Hauptaktion als dunkle Pille daneben mit »
const ACTION_ROW = clsx(
  "[&_.flex-wrap]:flex-nowrap [&_.flex-wrap]:items-center",
  "[&_.flex-wrap>button:not([aria-label=Absage])]:flex-1",
  "[&_button[aria-label=Absage]]:order-first [&_button[aria-label=Absage]]:h-8 [&_button[aria-label=Absage]]:w-8 [&_button[aria-label=Absage]]:rounded-full [&_button[aria-label=Absage]]:bg-error/10 [&_button[aria-label=Absage]]:text-error",
  "[&_button[aria-label=Absage]:hover]:bg-error/20 [&_button[aria-label=Absage]:hover]:text-error",
  "[&_.btn-rainbow:not([aria-busy])]:after:content-['››'] [&_.btn-rainbow]:after:-ml-0.5 [&_.btn-rainbow]:after:tracking-[-0.1em]"
);

export function LeadCard({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const overdue = lead.next_step_at && new Date(lead.next_step_at) < new Date();
  const source = SOURCE_STYLE[lead.source] ?? SOURCE_STYLE.manuell;
  const pkg = packageText(lead);
  return (
    <article className={cardClass(overlay)} style={{ borderLeftColor: STAGE_COLOR[lead.stage] }}>
      <div className="flex items-center gap-2">
        <TagChip color={source.color}>{sourceLabel(lead.source)}</TagChip>
        <span className="ml-auto shrink-0 text-[11.5px] text-snow/40 tabular-nums">{formatDate(lead.created_at, { day: "2-digit", month: "2-digit" })}</span>
      </div>
      <p className="mt-2 truncate text-[15px] leading-snug font-semibold">{lead.company || lead.name}</p>
      {lead.company && <p className="truncate text-[13px] text-snow/55">{lead.name}</p>}
      {lead.message && <p className="mt-1.5 truncate text-[12.5px] text-snow/50">{lead.message}</p>}
      {lead.next_step && (
        <p className={clsx("mt-2 flex items-center gap-1.5 text-[12px]", overdue ? "text-error" : "text-snow/65")}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {lead.next_step}
            {lead.next_step_at &&
              ` · ${new Date(lead.next_step_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}`}
          </span>
        </p>
      )}
      <p className={clsx("mt-2.5 flex items-center gap-2 rounded-xl bg-snow/[0.04] px-2.5 py-1.5 text-[12.5px]", pkg ? "font-medium text-snow/80" : "text-snow/45")}>
        <Package className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="truncate tabular-nums">{pkg ?? "Noch kein Paket gewählt"}</span>
      </p>
      <div className="mt-3">
        <OwnerLine owner={lead.owner} time={since(lead.created_at)} />
      </div>
      {!overlay && (
        <div className={clsx("mt-3 border-t border-snow/[0.06] pt-3", ACTION_ROW)}>
          <LeadActions lead={lead} />
        </div>
      )}
    </article>
  );
}

// ---------- Tabelle und Archiv ----------

function StageDot({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

function OwnerCell({ owner }: { owner: string | null }) {
  const { find } = useOwnerMatch();
  const member = find(owner);
  const name = member?.name ?? owner;
  if (!name) return <span className="text-snow/40">–</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <PersonAvatar name={name} email={member?.email} className="h-6 w-6 text-[10px]" />
      {name}
    </span>
  );
}

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.id, i])) as Record<Stage, number>;

function LeadTable({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const rows = [...leads].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || byPosition(a, b));
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
      <section className={PANEL_CLASS}>
        {rows.length === 0 ? (
          <Empty title="Keine Leads" text="Mit diesen Filtern gibt es keine offenen Leads." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13.5px]">
              <thead>
                <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                  <th className="px-5 py-3 font-medium">Firma</th>
                  <th className="px-3 py-3 font-medium">Phase</th>
                  <th className="px-3 py-3 font-medium">Quelle</th>
                  <th className="px-3 py-3 text-right font-medium">Wert/Monat</th>
                  <th className="px-3 py-3 font-medium">Zuständig</th>
                  <th className="px-3 py-3 font-medium">Nächster Schritt</th>
                  <th className="px-5 py-3 text-right font-medium">Eingang</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((lead) => (
                  <tr
                    key={lead.id}
                    tabIndex={0}
                    onClick={() => onOpen(lead.id)}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(lead.id)}
                    className="cursor-pointer border-b border-snow/[0.05] last:border-0 hover:bg-snow/[0.03] focus-visible:bg-snow/[0.05] focus-visible:outline-none"
                  >
                    <td className="max-w-64 px-5 py-3">
                      <span className="block truncate font-semibold">{lead.company || lead.name}</span>
                      {lead.company && <span className="block truncate text-[12px] text-snow/50">{lead.name}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StageDot stage={lead.stage} />
                    </td>
                    <td className="px-3 py-3">
                      <TagChip color={(SOURCE_STYLE[lead.source] ?? SOURCE_STYLE.manuell).color}>{sourceLabel(lead.source)}</TagChip>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{lead.value ? euro(lead.value) : <span className="text-snow/40">–</span>}</td>
                    <td className="px-3 py-3">
                      <OwnerCell owner={lead.owner} />
                    </td>
                    <td className="max-w-56 truncate px-3 py-3 text-snow/70">
                      {lead.next_step
                        ? `${lead.next_step}${lead.next_step_at ? ` · ${formatDate(lead.next_step_at, { day: "numeric", month: "short" })}` : ""}`
                        : <span className="text-snow/40">–</span>}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-snow/55">{since(lead.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

type ArchiveFilter = "alle" | "gewonnen" | "verloren";

/** Archiv: gewonnene Leads (Kunde gewonnen) und abgesagte (status verloren) */
function LeadArchive({ won, onOpen }: { won: Lead[]; onOpen: (id: string) => void }) {
  const lost = useResource<Lead[]>("/api/sales/leads?status=verloren");
  const [filter, setFilter] = useState<ArchiveFilter>("alle");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [
      ...(filter !== "verloren" ? won : []),
      ...(filter !== "gewonnen" ? (lost.data ?? []) : []),
    ];
    return all
      .filter((lead) => !q || [lead.name, lead.company, lead.email, lead.lost_reason].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.won_at ?? b.updated_at).getTime() - new Date(a.won_at ?? a.updated_at).getTime());
  }, [won, lost.data, filter, query]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4 md:px-6 md:pb-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchPill value={query} onChange={setQuery} label="Archiv durchsuchen" className="w-56 lg:w-64" />
        <Segmented
          label="Archiv filtern"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "alle", label: "Alle" },
            { id: "gewonnen", label: `Gewonnen · ${won.length}` },
            { id: "verloren", label: `Verloren · ${lost.data?.length ?? "…"}` },
          ]}
        />
      </div>
      <section className={PANEL_CLASS}>
        {lost.loading && filter !== "gewonnen" ? (
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <Empty title="Archiv ist leer" text="Gewonnene und abgesagte Leads erscheinen hier." />
        ) : (
          <ul className="divide-y divide-snow/[0.06]">
            {rows.map((lead) => (
              <ArchiveRow key={lead.id} lead={lead} onOpen={lead.status === "offen" ? () => onOpen(lead.id) : undefined} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ArchiveRow({ lead, onOpen }: { lead: Lead; onOpen?: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const isWon = lead.status === "offen";

  async function restore() {
    setBusy(true);
    try {
      await updateRow<Lead>("leads", lead.id, { status: "offen", lost_reason: null, position: topPosition() });
      revalidate("/api/sales/leads");
      toast(`${lead.company || lead.name} ist wieder in der Pipeline`);
    } catch {
      toast("Das hat nicht geklappt", "error");
      setBusy(false);
    }
  }

  const body = (
    <>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: isWon ? STAGE_COLOR.gewonnen : "#ec8a84" }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold">{lead.company || lead.name}</span>
        <span className="block truncate text-[12.5px] text-snow/50">
          {[lead.company && lead.name, sourceLabel(lead.source), !isWon && (lead.lost_reason || "ohne Grund")].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <span className="block text-[13.5px] font-medium tabular-nums">{lead.value ? `${euro(lead.value)}/M` : "–"}</span>
        <span className="block text-[12px] text-snow/45">
          {isWon ? "gewonnen" : "abgesagt"} {formatDate(lead.won_at ?? lead.updated_at)}
        </span>
      </span>
    </>
  );

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {isWon ? (
        <span className="w-[136px] shrink-0 text-right text-[12px] font-medium" style={{ color: accentText("#2f9e44") }}>
          Kunde gewonnen
        </span>
      ) : (
        <Button size="sm" className="w-[136px]" icon={<RotateCcw className="h-3.5 w-3.5" />} loading={busy} loadingText="Wird geholt …" onClick={restore}>
          Zurückholen
        </Button>
      )}
    </li>
  );
}
