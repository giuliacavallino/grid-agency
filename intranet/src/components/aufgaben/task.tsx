"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn as clsx } from "@/lib/cn";
import { Check, Plus, Trash2, X } from "lucide-react";
import { deleteRow, updateRow } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import type { ChecklistItem, Task, TaskProject, TaskSection } from "@/lib/tasks";
import { Button, Dialog, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";

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

/** Detailansicht ohne Speichern-Knopf: Auswahlfelder und Checkliste
 * speichern sofort, Texte kurz nach dem Tippen und beim Verlassen. */
function TaskDetail({ task, sections, people, onClose }: { task: Task; sections: TaskSection[]; people: string[]; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const pending = useRef<Partial<Task>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const commit = useCallback(
    async (patch: Partial<Task>) => {
      setSaving((n) => n + 1);
      try {
        await updateRow<Task>("tasks", task.id, patch);
      } catch {
        toast("Speichern fehlgeschlagen", "error");
      }
      setSaving((n) => n - 1);
    },
    [task.id, toast]
  );

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) commit(patch);
  }, [commit]);

  // Beim Schließen noch Ausstehendes speichern
  useEffect(() => flush, [flush]);

  function saveSoon(patch: Partial<Task>) {
    pending.current = { ...pending.current, ...patch };
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }

  const setChecklist = (items: ChecklistItem[]) => commit({ checklist: items });

  function addItem(event: React.FormEvent) {
    event.preventDefault();
    if (!newItem.trim()) return;
    setChecklist([...task.checklist, { text: newItem.trim(), done: false }]);
    setNewItem("");
  }

  async function remove() {
    clearTimeout(timer.current);
    pending.current = {};
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
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) saveSoon({ title: e.target.value.trim() });
          }}
          onBlur={() => (title.trim() ? flush() : setTitle(task.title))}
          rows={2}
          aria-label="Titel"
          className={clsx("min-h-0 resize-none text-[16px] font-medium", task.done && "text-snow/50 line-through")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Thema">
          {(id) => (
            <Select id={id} value={task.section_id ?? ""} onChange={(e) => commit({ section_id: e.target.value })}>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fällig am">
          {(id) => <Input id={id} type="date" value={task.due_on ?? ""} onChange={(e) => commit({ due_on: e.target.value || null })} />}
        </Field>
        <Field label="Zuständig" className="col-span-2">
          {(id) => (
            <>
              <Input
                id={id}
                value={assignee}
                onChange={(e) => {
                  setAssignee(e.target.value);
                  saveSoon({ assignee: e.target.value.trim() || null });
                }}
                onBlur={flush}
                list={`${id}-people`}
                placeholder="Name"
              />
              <datalist id={`${id}-people`}>
                {people.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Notizen" className="col-span-2">
          {(id) => (
            <Textarea
              id={id}
              rows={5}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                saveSoon({ notes: e.target.value.trim() || null });
              }}
              onBlur={flush}
            />
          )}
        </Field>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-snow/60">
          Checkliste{task.checklist.length > 0 && ` · ${task.checklist.filter((c) => c.done).length}/${task.checklist.length}`}
        </p>
        <ul className="flex flex-col gap-1">
          {task.checklist.map((item, i) => (
            <li key={i} className="group flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-snow/[0.04]">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => setChecklist(task.checklist.map((c, j) => (j === i ? { ...c, done: !c.done } : c)))}
                className="h-4 w-4 accent-[#30a46c]"
                aria-label={item.text}
              />
              <span className={clsx("flex-1 text-sm", item.done && "text-snow/45 line-through")}>{item.text}</span>
              <IconButton label="Punkt entfernen" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => setChecklist(task.checklist.filter((_, j) => j !== i))}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
        <form onSubmit={addItem} className="mt-1 flex gap-2">
          <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Punkt hinzufügen, Enter" className="h-9" />
          <Button type="submit" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} disabled={!newItem.trim()}>
            Hinzufügen
          </Button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-snow/[0.08] pt-4">
        <p className="flex items-center gap-1.5 text-[12px] text-snow/45" aria-live="polite">
          {saving > 0 ? (
            <>
              <Spinner className="h-3.5 w-3.5" /> Wird gespeichert …
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> Änderungen werden automatisch gespeichert
            </>
          )}
        </p>
        <Button variant="ghost" size="sm" className="ml-auto text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
          Löschen
        </Button>
      </div>
      <p className="-mt-3 text-[12px] text-snow/40">
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
