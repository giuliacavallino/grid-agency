"use client";

import { useState } from "react";
import { cn as clsx } from "@/lib/cn";
import { AlignLeft, CalendarDays, Check, ListChecks, Plus, Trash2, X } from "lucide-react";
import { deleteRow, updateRow } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { dueLabel, isOverdue, type ChecklistItem, type Task, type TaskProject, type TaskSection } from "@/lib/tasks";
import { BoardCard } from "@/components/board";
import { Avatar, Button, Dialog, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";

/** Abhaken direkt auf der Karte, ohne die Karte zu öffnen oder zu ziehen */
export function DoneToggle({ task, className }: { task: Task; className?: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy(true);
    try {
      await updateRow<Task>("tasks", task.id, { done: !task.done });
    } catch {
      toast("Konnte nicht gespeichert werden", "error");
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      disabled={busy}
      aria-busy={busy || undefined}
      aria-pressed={task.done}
      aria-label={task.done ? "Als offen markieren" : "Als erledigt markieren"}
      className={clsx(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors aria-busy:cursor-progress",
        task.done ? "border-[#30a46c] bg-[#30a46c] text-white" : "border-snow/30 text-transparent hover:border-[#30a46c] hover:text-[#30a46c]",
        className
      )}
    >
      {busy ? <Spinner className="h-3 w-3 text-current" /> : <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

export function TaskMeta({ task, project }: { task: Task; project?: TaskProject }) {
  const checked = task.checklist.filter((c) => c.done).length;
  const late = isOverdue(task);
  const hasMeta = project || task.due_on || task.notes || task.checklist.length || task.assignee;
  if (!hasMeta) return null;
  return (
    <div className="mt-2 flex items-center gap-2.5 pl-[26px] text-[12px] text-snow/50">
      {project && (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color }} />
          <span className="truncate">{project.name}</span>
        </span>
      )}
      {task.due_on && (
        <span className={clsx("flex shrink-0 items-center gap-1", late && "font-medium text-error")}>
          <CalendarDays className="h-3.5 w-3.5" />
          {dueLabel(task.due_on)}
        </span>
      )}
      {!!task.checklist.length && (
        <span className="flex shrink-0 items-center gap-1">
          <ListChecks className="h-3.5 w-3.5" />
          {checked}/{task.checklist.length}
        </span>
      )}
      {task.notes && <AlignLeft className="h-3.5 w-3.5 shrink-0" aria-label="mit Notiz" />}
      {task.assignee && (
        <span className="ml-auto" title={task.assignee}>
          <Avatar name={task.assignee} className="h-5 w-5 text-[9px]" />
        </span>
      )}
    </div>
  );
}

export function TaskCard({ task, overlay }: { task: Task; overlay?: boolean }) {
  return (
    <BoardCard overlay={overlay}>
      <div className="flex items-start gap-2">
        <DoneToggle task={task} className="mt-px" />
        <p className={clsx("min-w-0 flex-1 text-[14px] leading-snug", task.done && "text-snow/45 line-through")}>{task.title}</p>
      </div>
      <TaskMeta task={task} />
    </BoardCard>
  );
}

type Form = { title: string; section_id: string; assignee: string; due_on: string; notes: string; checklist: ChecklistItem[] };

const toForm = (t: Task): Form => ({
  title: t.title,
  section_id: t.section_id ?? "",
  assignee: t.assignee ?? "",
  due_on: t.due_on ?? "",
  notes: t.notes ?? "",
  checklist: t.checklist,
});

export function TaskSheet({
  task,
  project,
  sections,
  people,
  onClose,
}: {
  task?: Task;
  project?: TaskProject;
  sections: TaskSection[];
  people: string[];
  onClose: () => void;
}) {
  return (
    <Sheet open={!!task} onClose={onClose} title={project?.name ?? "To-do"} subtitle={task && sections.find((s) => s.id === task.section_id)?.name}>
      {task && <TaskDetail key={task.id} task={task} sections={sections} people={people} onClose={onClose} />}
    </Sheet>
  );
}

function TaskDetail({ task, sections, people, onClose }: { task: Task; sections: TaskSection[]; people: string[]; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(task));
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(task));
  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  const setChecklist = (update: (items: ChecklistItem[]) => ChecklistItem[]) => setForm((f) => ({ ...f, checklist: update(f.checklist) }));

  function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!newItem.trim()) return;
    setChecklist((items) => [...items, { text: newItem.trim(), done: false }]);
    setNewItem("");
  }

  async function save() {
    if (!form.title.trim()) return toast("Titel fehlt", "error");
    setSaving(true);
    try {
      await updateRow<Task>("tasks", task.id, {
        title: form.title.trim(),
        section_id: form.section_id || null,
        assignee: form.assignee.trim() || null,
        due_on: form.due_on || null,
        notes: form.notes.trim() || null,
        checklist: form.checklist,
      });
      toast("Gespeichert");
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteRow("tasks", task.id);
      onClose();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <DoneToggle task={task} className="mt-3 h-6 w-6" />
        <Textarea
          value={form.title}
          onChange={set("title")}
          rows={2}
          aria-label="Titel"
          className={clsx("min-h-0 resize-none text-[16px] font-medium", task.done && "text-snow/50 line-through")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Thema">
          {(id) => (
            <Select id={id} value={form.section_id} onChange={set("section_id")}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fällig am">{(id) => <Input id={id} type="date" value={form.due_on} onChange={set("due_on")} />}</Field>
        <Field label="Zuständig" className="col-span-2">
          {(id) => (
            <>
              <Input id={id} value={form.assignee} onChange={set("assignee")} list={`${id}-people`} placeholder="Name" />
              <datalist id={`${id}-people`}>
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Notizen" className="col-span-2">
          {(id) => <Textarea id={id} rows={5} value={form.notes} onChange={set("notes")} />}
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-snow/60">
          Checkliste{form.checklist.length > 0 && ` · ${form.checklist.filter((c) => c.done).length}/${form.checklist.length}`}
        </p>
        <ul className="flex flex-col gap-1">
          {form.checklist.map((item, i) => (
            <li key={i} className="group flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-snow/[0.04]">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => setChecklist((items) => items.map((c, j) => (j === i ? { ...c, done: !c.done } : c)))}
                className="h-4 w-4 accent-[#30a46c]"
                aria-label={item.text}
              />
              <span className={clsx("flex-1 text-sm", item.done && "text-snow/45 line-through")}>{item.text}</span>
              <IconButton label="Punkt entfernen" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setChecklist((items) => items.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
        <form onSubmit={addItem} className="mt-1 flex gap-2">
          <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Punkt hinzufügen" className="h-9" />
          <Button type="submit" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} disabled={!newItem.trim()}>
            Hinzufügen
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={saving} loadingText="Wird gespeichert …" disabled={!dirty}>
          Speichern
        </Button>
        <Button variant="ghost" className="ml-auto text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
          Löschen
        </Button>
      </div>
      <p className="text-[12px] text-snow/40">
        Angelegt {formatDateTime(task.created_at)}
        {task.done_at && ` · erledigt ${formatDateTime(task.done_at)}`}
      </p>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="To-do löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={deleting} loadingText="Wird gelöscht …" onClick={remove}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">„{task.title}“ wird endgültig entfernt. Zum Abhaken reicht der Kreis links.</p>
      </Dialog>
    </div>
  );
}
