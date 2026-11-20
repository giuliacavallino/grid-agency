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
import { topPosition } from "@/lib/sales/types";
import { COLUMN_CLASS, COLUMN_OVER_CLASS, ColumnHeader, EmptyColumn } from "@/components/sales/pipeline";

type BoardColumn = { id: string; label: string; color: string };
type BoardItem = { id: string; stage: string; position: number };

type Columns = Record<string, string[]>;

const byPosition = (a: BoardItem, b: BoardItem) => b.position - a.position;

function findColumn(columns: Columns, id: string): string | null {
  if (id in columns) return id;
  return Object.keys(columns).find((stage) => columns[stage].includes(id)) ?? null;
}

/** Bewerber-Pipeline als Kanban im Stil der Sales-Pipeline: hohe weiße
 * Spalten, Karten per Drag & Drop verschieben (Logik wie components/board.tsx).
 * canDrop sperrt Spalten, die nur über eine Aktion erreichbar sind. */
export function ApplicantBoard<T extends BoardItem>({
  columns: columnDefs,
  items,
  renderCard,
  onOpen,
  onMove,
  canDrop = () => true,
  onAdd,
  addLabel,
  summary,
}: {
  columns: readonly BoardColumn[];
  items: T[];
  renderCard: (item: T, overlay?: boolean) => React.ReactNode;
  onOpen: (id: string) => void;
  onMove: (item: T, stage: string, position: number) => void;
  canDrop?: (item: T, stage: string) => boolean;
  onAdd?: () => void;
  addLabel?: string;
  summary?: (items: T[]) => React.ReactNode;
}) {
  const [dragging, setDragging] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const base = useMemo(() => {
    const cols = Object.fromEntries(columnDefs.map((c) => [c.id, [] as string[]])) as Columns;
    for (const item of [...items].sort(byPosition)) cols[item.stage]?.push(item.id);
    return cols;
  }, [items, columnDefs]);
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

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragging) return;
    const from = findColumn(dragging, String(active.id));
    const to = findColumn(dragging, String(over.id));
    if (!from || !to || from === to) return;
    const item = byId.get(String(active.id));
    if (!item || (to !== item.stage && !canDrop(item, to))) return;
    setDragging((cols) => {
      if (!cols) return cols;
      const target = [...cols[to]];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex < 0 ? target.length : overIndex, 0, String(active.id));
      return { ...cols, [from]: cols[from].filter((id) => id !== active.id), [to]: target };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const cols = dragging;
    setActiveId(null);
    setDragging(null);
    if (!over || !cols) return;

    const id = String(active.id);
    const stage = findColumn(cols, id);
    if (!stage) return;
    const list = [...cols[stage]];
    const oldIndex = list.indexOf(id);
    const newIndex = String(over.id) in cols ? list.length - 1 : list.indexOf(String(over.id));
    list.splice(oldIndex, 1);
    list.splice(newIndex < 0 ? list.length : newIndex, 0, id);
    const index = list.indexOf(id);

    const above = byId.get(list[index - 1]);
    const below = byId.get(list[index + 1]);
    const position =
      above && below ? (above.position + below.position) / 2 : above ? above.position - 60 : below ? below.position + 60 : topPosition();

    const item = byId.get(id)!;
    if (item.stage === stage && list.join() === base[stage].join()) return;
    onMove(item, stage, position);
  }

  const active = activeId ? byId.get(activeId) : null;

  return (
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
        {columnDefs.map((column, i) => {
          const list = columns[column.id].map((id) => byId.get(id)!).filter(Boolean);
          return (
            <Column
              key={column.id}
              column={column}
              items={list}
              summary={summary?.(list)}
              renderCard={renderCard}
              onOpen={onOpen}
              onAdd={i === 0 ? onAdd : undefined}
              addLabel={addLabel}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {active && renderCard(active, true)}
      </DragOverlay>
    </DndContext>
  );
}

function Column<T extends BoardItem>({
  column,
  items,
  summary,
  renderCard,
  onOpen,
  onAdd,
  addLabel,
}: {
  column: BoardColumn;
  items: T[];
  summary?: React.ReactNode;
  renderCard: (item: T) => React.ReactNode;
  onOpen: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section aria-label={column.label} className={clsx(COLUMN_CLASS, isOver && COLUMN_OVER_CLASS)}>
      <ColumnHeader color={column.color} label={column.label} count={items.length} extra={summary} onAdd={onAdd} addLabel={addLabel} />
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
          {items.map((item) => (
            <SortableCard key={item.id} id={item.id} onOpen={onOpen}>
              {renderCard(item)}
            </SortableCard>
          ))}
          {items.length === 0 && <EmptyColumn />}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortableCard({ id, onOpen, children }: { id: string; onOpen: (id: string) => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(id)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (event.key === "Enter" && !event.defaultPrevented) onOpen(id);
      }}
    >
      {children}
    </li>
  );
}
