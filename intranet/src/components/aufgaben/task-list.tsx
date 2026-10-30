"use client";

import { useMemo, useRef, useState } from "react";
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
import { CalendarDays, ChevronDown, ChevronRight, GripVertical, MoreHorizontal, PanelRightOpen, Plus } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { createRow, updateRow } from "@/lib/data";
import { topPosition } from "@/lib/sales/types";
import { dueLabel, isOverdue, type Task, type TaskProject, type TaskSection } from "@/lib/tasks";
import { Avatar, IconButton, Spinner, useToast } from "@/components/ui";
import { DoneToggle } from "./task";

type Groups = Record<string, string[]>;

const byPosition = (a: Task, b: Task) => b.position - a.position;

function findGroup(groups: Groups, id: string): string | null {
  if (id in groups) return id;
  return Object.keys(groups).find((key) => groups[key].includes(id)) ?? null;
}

/** Spaltenköpfe über der Liste (nur Desktop) */
export function ListHeader({ withProject = false }: { withProject?: boolean }) {
  return (
    <div className="sticky top-0 z-10 hidden h-9 items-center border-b border-snow/[0.08] bg-canvas pr-12 pl-[60px] text-[12px] text-snow/45 md:flex">
      <span className="flex-1">To-do</span>
      {withProject && <span className="w-36">Kunde</span>}
      <span className="w-44 pl-1.5">Zuständig</span>
      <span className="w-28 pl-1.5">Fällig</span>
    </div>
  );
}

/** To-dos eines Kunden als Liste wie in Asana: Themen als aufklappbare
 * Gruppen, To-dos untereinander, Titel, Zuständig und Fälligkeit direkt in
 * der Zeile bearbeitbar. Ziehen am Griff sortiert, auch in andere Themen. */
export function SectionedList({
  project,
  sections,
  tasks,
  people,
  onOpen,
  onEditSection,
}: {
  project: TaskProject;
  sections: TaskSection[];
  tasks: Task[];
  people: string[];
  onOpen: (id: string) => void;
  onEditSection: (section: TaskSection) => void;
}) {
  const toast = useToast();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState<Groups | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const base = useMemo(() => {
    const groups = Object.fromEntries(sections.map((s) => [s.id, [] as string[]])) as Groups;
    for (const task of [...tasks].sort(byPosition)) {
      const key = task.section_id && task.section_id in groups ? task.section_id : sections[0]?.id;
      if (key) groups[key].push(task.id);
    }
    return groups;
  }, [tasks, sections]);
  const groups = dragging ?? base;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragging(base);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !dragging) return;
    const from = findGroup(dragging, String(active.id));
    const to = findGroup(dragging, String(over.id));
    if (!from || !to || from === to) return;
    setDragging((g) => {
      if (!g) return g;
      const target = [...g[to]];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex < 0 ? target.length : overIndex, 0, String(active.id));
      return { ...g, [from]: g[from].filter((id) => id !== active.id), [to]: target };
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    const g = dragging;
    setActiveId(null);
    setDragging(null);
    if (!over || !g) return;
    const id = String(active.id);
    const section = findGroup(g, id);
    if (!section) return;
    const list = [...g[section]];
    const oldIndex = list.indexOf(id);
    const newIndex = String(over.id) in g ? list.length - 1 : list.indexOf(String(over.id));
    list.splice(oldIndex, 1);
    list.splice(newIndex < 0 ? list.length : newIndex, 0, id);
    const index = list.indexOf(id);
    if (list.join() === base[section]?.join()) return;

    const above = byId.get(list[index - 1]);
    const below = byId.get(list[index + 1]);
    const position =
      above && below ? (above.position + below.position) / 2 : above ? above.position - 60 : below ? below.position + 60 : topPosition();
    try {
      await updateRow<Task>("tasks", id, { section_id: section, position });
    } catch {
      toast("Verschieben fehlgeschlagen", "error");
    }
  }

  const toggle = (id: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      {sections.map((section) => {
        const list = groups[section.id].map((id) => byId.get(id)!).filter(Boolean);
        const open = list.filter((t) => !t.done).length;
        const isCollapsed = collapsed.has(section.id) && !activeId;
        return (
          <section key={section.id} aria-label={section.name} className="pt-5">
            <header className="group flex h-9 items-center gap-1 pr-2 pl-1 md:pl-6">
              <button
                type="button"
                onClick={() => toggle(section.id)}
                aria-expanded={!isCollapsed}
                className="flex min-w-0 items-center gap-1.5 rounded-lg py-1 pr-2 pl-1 text-left hover:bg-snow/[0.06]"
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 text-snow/50" /> : <ChevronDown className="h-4 w-4 shrink-0 text-snow/50" />}
                <h2 className="truncate text-[15px] font-semibold">{section.name}</h2>
                <span className="text-[13px] text-snow/40">{open}</span>
              </button>
              <IconButton
                label={`Thema „${section.name}“ bearbeiten`}
                className="h-7 w-7 text-snow/45 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                onClick={() => onEditSection(section)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            </header>
            {!isCollapsed && (
              <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <DropArea id={section.id}>
                  {list.map((task) => (
                    <SortableRow key={task.id} id={task.id}>
                      {(handle) => <TaskRow task={task} people={people} onOpen={onOpen} handle={handle} />}
                    </SortableRow>
                  ))}
                  <QuickAdd projectId={project.id} sectionId={section.id} />
                </DropArea>
              </SortableContext>
            )}
          </section>
        );
      })}
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {active && (
          <div className="rounded-xl border border-snow/20 bg-surface shadow-[0_18px_40px_var(--shadow-strong)]">
            <TaskRow task={active} people={people} onOpen={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DropArea({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <ul ref={setNodeRef} className={clsx("border-t border-snow/[0.06] transition-colors", isOver && "bg-snow/[0.03]")}>
      {children}
    </ul>
  );
}

type Handle = React.HTMLAttributes<HTMLButtonElement>;

function SortableRow({ id, children }: { id: string; children: (handle: Handle) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={clsx(isDragging && "opacity-30")}>
      {children({ ...attributes, ...listeners })}
    </li>
  );
}

/** Eine Zeile: Griff, Abhaken, Titel (direkt bearbeitbar), Zuständig,
 * Fälligkeit und Details. Mit project zeigt sie den Kunden statt des Griffs. */
export function TaskRow({
  task,
  people,
  onOpen,
  handle,
  project,
}: {
  task: Task;
  people: string[];
  onOpen: (id: string) => void;
  handle?: Handle;
  project?: TaskProject;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(task.title);
  const [synced, setSynced] = useState(task.title);
  // Titel von außen geändert (z. B. in der Detailansicht) → übernehmen
  if (task.title !== synced) {
    setSynced(task.title);
    setTitle(task.title);
  }
  const late = isOverdue(task);

  async function save(patch: Partial<Task>) {
    try {
      await updateRow<Task>("tasks", task.id, patch);
    } catch {
      toast("Konnte nicht gespeichert werden", "error");
    }
  }

  function saveTitle() {
    const value = title.trim();
    if (!value) return setTitle(task.title);
    if (value !== task.title) save({ title: value });
  }

  return (
    <div className="group flex min-h-11 items-start gap-1 border-b border-snow/[0.06] pr-2 pl-1 hover:bg-snow/[0.03] md:items-center md:pl-2">
      {handle ? (
        <button
          type="button"
          aria-label="Ziehen zum Sortieren"
          className="mt-3 flex h-5 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-snow/30 opacity-100 active:cursor-grabbing md:mt-0 md:opacity-0 md:group-hover:opacity-100"
          {...handle}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <DoneToggle task={task} className="mt-3 ml-1 md:mt-0" />

      <div className="min-w-0 flex-1 py-1.5 pl-1.5 md:py-0">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setTitle(task.title);
              e.currentTarget.blur();
            }
          }}
          aria-label="Titel"
          className={clsx(
            "h-8 w-full truncate rounded-md bg-transparent px-1.5 text-[14px] outline-none focus:bg-snow/[0.06] focus:ring-1 focus:ring-snow/20",
            task.done && "text-snow/45 line-through"
          )}
        />
        {/* Mobil: Kunde, Fälligkeit und Person unter dem Titel */}
        <div className="flex items-center gap-2 px-1.5 text-[12px] text-snow/50 md:hidden">
          {project && <ProjectLabel project={project} />}
          {task.due_on && <span className={clsx(late && "font-medium text-error")}>{dueLabel(task.due_on)}</span>}
          {task.assignee && <span className="truncate">{task.assignee}</span>}
        </div>
      </div>

      {project && (
        <span className="hidden w-36 shrink-0 md:block">
          <ProjectLabel project={project} />
        </span>
      )}
      <label className="relative hidden w-44 shrink-0 items-center gap-2 rounded-md px-1.5 py-1 hover:bg-snow/[0.06] md:flex">
        {task.assignee ? <Avatar name={task.assignee} className="h-6 w-6 text-[10px]" /> : <span className="h-6 w-6 rounded-full border border-dashed border-snow/25" />}
        <span className={clsx("truncate text-[13px]", task.assignee ? "text-snow/80" : "text-snow/35")}>{task.assignee ?? "Niemand"}</span>
        <select
          value={task.assignee ?? ""}
          onChange={(e) => save({ assignee: e.target.value || null })}
          aria-label="Zuständig"
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="">Niemand</option>
          {[...new Set([...people, ...(task.assignee ? [task.assignee] : [])])].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <DueField task={task} onChange={(due_on) => save({ due_on })} />

      <IconButton label="Details öffnen" className="mt-1.5 h-8 w-8 text-snow/50 md:mt-0" onClick={() => onOpen(task.id)}>
        <PanelRightOpen className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

function ProjectLabel({ project }: { project: TaskProject }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-snow/60">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

/** Fälligkeit als Text, Klick öffnet den Datumswähler des Browsers */
function DueField({ task, onChange }: { task: Task; onChange: (due: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const late = isOverdue(task);
  return (
    <div className="relative hidden w-28 shrink-0 md:block">
      <button
        type="button"
        onClick={() => {
          try {
            input.current?.showPicker();
          } catch {
            input.current?.focus();
          }
        }}
        className={clsx(
          "flex h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-[13px] hover:bg-snow/[0.06]",
          task.due_on ? (late ? "font-medium text-error" : "text-snow/75") : "text-snow/30"
        )}
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        {task.due_on ? dueLabel(task.due_on) : <span className="opacity-0 group-hover:opacity-100">Datum</span>}
      </button>
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-label="Fällig am"
        value={task.due_on ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </div>
  );
}

/** Letzte Zeile jedes Themas: Klick → Eingabefeld, Enter legt an und das
 * Feld bleibt für das nächste To-do offen. */
function QuickAdd({ projectId, sectionId }: { projectId: string; sectionId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await createRow<Task>("tasks", { project_id: projectId, section_id: sectionId, title: title.trim(), position: topPosition() });
      setTitle("");
    } catch {
      toast("Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
    input.current?.focus();
  }

  return (
    <li>
      {open ? (
        <form onSubmit={submit} className="flex h-11 items-center gap-2 border-b border-snow/[0.06] pr-2 pl-[34px] md:pl-[38px]">
          <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-dashed border-snow/30" />
          <input
            ref={input}
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && !busy && setOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && (setTitle(""), setOpen(false))}
            placeholder="To-do eingeben, Enter zum Anlegen"
            aria-label="Neues To-do"
            aria-busy={busy || undefined}
            className="h-8 flex-1 rounded-md bg-snow/[0.06] px-2 text-[14px] outline-none ring-1 ring-snow/20"
          />
          {busy && <Spinner className="h-4 w-4" />}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 w-full items-center gap-2 pl-[34px] text-[13px] text-snow/45 hover:text-snow md:pl-[38px]"
        >
          <Plus className="h-4 w-4" /> To-do hinzufügen
        </button>
      )}
    </li>
  );
}
