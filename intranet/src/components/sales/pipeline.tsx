"use client";

import { useMemo, useState } from "react";
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
import { CalendarClock, Plus, Search } from "lucide-react";
import { revalidate, updateRow, useRows } from "@/lib/data";
import { euro, relativeTime } from "@/lib/format";
import { SOURCES, STAGES, topPosition, type Lead, type Stage } from "@/lib/sales/types";
import { Button, Empty, Input, Select, Spinner, useToast } from "@/components/ui";
import { PageBar } from "./shell";
import { SourceBadge } from "./source";
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

export function Pipeline() {
  const { data: leads, loading, error } = useRows<Lead>("leads", "status=offen");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [dragging, setDragging] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const byId = useMemo(() => new Map((leads ?? []).map((lead) => [lead.id, lead])), [leads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads ?? []).filter(
      (lead) =>
        (!source || lead.source === source) &&
        (!q || [lead.name, lead.company, lead.email].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [leads, query, source]);

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

  const openLeads = leads?.filter((lead) => lead.stage !== "gewonnen") ?? [];
  const pipelineValue = openLeads.reduce((sum, lead) => sum + (lead.value ?? 0), 0);
  const activeLead = activeId ? byId.get(activeId) : null;

  return (
    <div className="flex h-full flex-col">
      <PageBar
        title="Pipeline"
        meta={leads && `${openLeads.length} offen · ${euro(pipelineValue)}/Monat im Gespräch`}
      >
        <div className="relative min-w-0 flex-1 md:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen"
            aria-label="Leads durchsuchen"
            className="h-9 w-full pl-9"
          />
        </div>
        <Select value={source} onChange={(e) => setSource(e.target.value)} className="h-9 w-auto max-w-36" aria-label="Quelle">
          <option value="">Alle Quellen</option>
          {SOURCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button
          variant="primary"
          size="sm"
          className="h-9 px-2.5 sm:px-3"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreating(true)}
          aria-label="Neuer Lead"
        >
          <span className="hidden sm:inline">Neuer Lead</span>
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Pipeline konnte nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
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
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-3 md:snap-none md:p-4">
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
    <section
      aria-label={label}
      className={clsx(
        "flex w-[82vw] max-w-[340px] shrink-0 snap-start flex-col rounded-2xl bg-snow/[0.04] transition-colors md:w-auto md:max-w-none md:min-w-[208px] md:flex-1",
        isOver && "bg-snow/[0.07]"
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
        <h2 className="text-[13px] font-medium">{label}</h2>
        <span className="text-[12px] text-snow/45">{leads.length}</span>
        <span className="ml-auto text-[12px] text-snow/45">{total > 0 && euro(total)}</span>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Lead hinzufügen"
            className="-mr-1 flex h-6 w-6 items-center justify-center rounded-md text-snow/50 hover:bg-snow/10 hover:text-snow"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </header>
      <SortableContext items={leads.map((lead) => lead.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {leads.map((lead) => (
            <SortableCard key={lead.id} lead={lead} onOpen={onOpen} />
          ))}
          {leads.length === 0 && (
            <li className="m-1 rounded-xl border border-dashed border-snow/12 py-6 text-center text-[12px] text-snow/35">
              Hierher ziehen
            </li>
          )}
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

export function LeadCard({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const overdue = lead.next_step_at && new Date(lead.next_step_at) < new Date();
  return (
    <article
      className={clsx(
        "cursor-grab rounded-xl border border-snow/[0.08] bg-surface p-3 shadow-[0_1px_2px_var(--shadow-color)] transition-[border-color,box-shadow] select-none hover:border-snow/20 active:cursor-grabbing",
        overlay && "rotate-[1.5deg] border-snow/25 shadow-[0_18px_40px_var(--shadow-strong)]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{lead.company || lead.name}</p>
          {lead.company && <p className="truncate text-[12px] text-snow/55">{lead.name}</p>}
        </div>
        <SourceBadge source={lead.source} compact />
      </div>
      {lead.stage === "neu" && lead.message && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-snow/50">{lead.message}</p>
      )}
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
      <div className="mt-2.5 flex items-center justify-between text-[12px] text-snow/45">
        <span>{relativeTime(lead.created_at)}</span>
        {lead.value ? <span className="font-medium text-snow/80">{euro(lead.value)}/M</span> : null}
      </div>
      {!overlay && (
        <div className="mt-2.5 border-t border-snow/[0.06] pt-2.5">
          <LeadActions lead={lead} />
        </div>
      )}
    </article>
  );
}
