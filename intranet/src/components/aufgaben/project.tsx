"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Archive, ArchiveRestore, Check, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { createRow, deleteRow, updateRow, useRows } from "@/lib/data";
import { isOverdue, PROJECT_COLORS, TEAM, type Task, type TaskProject, type TaskSection } from "@/lib/tasks";
import { Badge, Button, Dialog, Empty, Field, IconButton, Input, MenuItem, Popover, Select, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { BriefingSheet } from "./briefing";
import { KeepVisible, TaskSheet } from "./task";
import { ListHeader, SectionedList } from "./task-list";

/** To-dos eines Kunden als Liste, gruppiert nach Themen. */
export function ProjectView({ id }: { id: string }) {
  const projects = useRows<TaskProject>("task_projects");
  const sectionRows = useRows<TaskSection>("task_sections");
  const taskRows = useRows<Task>("tasks");
  const [query, setQuery] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [sectionDialog, setSectionDialog] = useState<TaskSection | "new" | null>(null);
  const [projectDialog, setProjectDialog] = useState(false);

  const project = projects.data?.find((p) => p.id === id);
  const sections = useMemo(
    () => (sectionRows.data ?? []).filter((s) => s.project_id === id).sort((a, b) => a.position - b.position),
    [sectionRows.data, id]
  );
  const allTasks = useMemo(() => (taskRows.data ?? []).filter((t) => t.project_id === id), [taskRows.data, id]);
  const people = TEAM;
  // Hier abgehakte To-dos bleiben bis zum Verlassen der Seite sichtbar
  const [keep, setKeep] = useState<Set<string>>(() => new Set());
  const keepVisible = useCallback((taskId: string) => setKeep((set) => new Set(set).add(taskId)), []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTasks
      .filter((t) => showDone || !t.done || keep.has(t.id))
      .filter((t) => !q || [t.title, t.notes, t.assignee].some((v) => v?.toLowerCase().includes(q)));
  }, [allTasks, showDone, query, keep]);

  const open = allTasks.filter((t) => !t.done);
  const overdue = open.filter(isOverdue).length;

  if (projects.error || sectionRows.error || taskRows.error) {
    return <Empty title="Aufgaben konnten nicht geladen werden" text={(projects.error ?? sectionRows.error ?? taskRows.error)?.message} />;
  }
  if (projects.loading || sectionRows.loading || taskRows.loading) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  if (!project) return <Empty title="Kunde nicht gefunden" />;

  return (
    <KeepVisible.Provider value={keepVisible}>
      <div className="flex h-full flex-col">
        <PageBar
          title={project.name}
          meta={
            <span className="flex items-center gap-2">
              {open.length} offen
              {overdue > 0 && <span className="text-error">· {overdue} überfällig</span>}
              {project.archived && <Badge>Archiv</Badge>}
            </span>
          }
        >
          <div className="relative min-w-0 flex-1 md:max-w-56">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="To-dos durchsuchen" className="h-9 w-full pl-9" />
          </div>
          <Button size="sm" className="h-9" variant={showDone ? "secondary" : "ghost"} aria-pressed={showDone} icon={<Check className="h-4 w-4" />} onClick={() => setShowDone((v) => !v)}>
            <span className="hidden sm:inline">Erledigte</span>
          </Button>
          <Button size="sm" className="h-9" icon={<FileText className="h-4 w-4" />} onClick={() => setBriefing(true)}>
            Briefing
          </Button>
          <ProjectMenu project={project} onEdit={() => setProjectDialog(true)} onAddSection={() => setSectionDialog("new")} />
        </PageBar>

        {sections.length === 0 ? (
          <Empty
            title="Noch keine Themen"
            text="Themen gruppieren die To-dos, z. B. JourFix, Content Days oder Performance Marketing."
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setSectionDialog("new")}>
                Thema anlegen
              </Button>
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pb-10">
            <ListHeader />
            <SectionedList project={project} sections={sections} tasks={visible} people={people} onOpen={setOpenId} onEditSection={setSectionDialog} />
            <button
              type="button"
              onClick={() => setSectionDialog("new")}
              className="mt-6 ml-2 flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] font-medium text-snow/55 hover:bg-snow/[0.06] hover:text-snow md:ml-6"
            >
              <Plus className="h-4 w-4" /> Thema hinzufügen
            </button>
          </div>
        )}

        <TaskSheet
          task={allTasks.find((t) => t.id === openId)}
          project={project}
          sections={sections}
          people={people}
          onClose={() => setOpenId(null)}
        />
        <BriefingSheet project={project} open={briefing} onClose={() => setBriefing(false)} />
        <SectionDialog
          key={sectionDialog === "new" ? "new" : sectionDialog?.id}
          projectId={project.id}
          section={sectionDialog}
          sections={sections}
          tasks={allTasks}
          onClose={() => setSectionDialog(null)}
        />
        <ProjectDialog key={project.id} open={projectDialog} project={project} onClose={() => setProjectDialog(false)} />
      </div>
    </KeepVisible.Provider>
  );
}

function ProjectMenu({ project, onEdit, onAddSection }: { project: TaskProject; onEdit: () => void; onAddSection: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleArchive(close: () => void) {
    setBusy(true);
    try {
      await updateRow<TaskProject>("task_projects", project.id, { archived: !project.archived });
      toast(project.archived ? "Wiederhergestellt" : "Ins Archiv verschoben");
      close();
      if (!project.archived) router.push("/aufgaben/archiv");
    } catch {
      toast("Konnte nicht gespeichert werden", "error");
    }
    setBusy(false);
  }

  return (
    <Popover
      trigger={({ toggle, open }) => (
        <IconButton label="Weitere Aktionen" aria-expanded={open} onClick={toggle} className="h-9 w-9">
          <MoreHorizontal className="h-4 w-4" />
        </IconButton>
      )}
    >
      {(close) => (
        <>
          <MenuItem icon={<Plus className="h-4 w-4" />} onClick={() => (close(), onAddSection())}>
            Thema hinzufügen
          </MenuItem>
          <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => (close(), onEdit())}>
            Name und Farbe
          </MenuItem>
          <MenuItem
            icon={busy ? <Spinner className="h-4 w-4" /> : project.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => toggleArchive(close)}
          >
            {busy ? "Wird gespeichert …" : project.archived ? "Aus dem Archiv holen" : "Archivieren"}
          </MenuItem>
        </>
      )}
    </Popover>
  );
}

/** Thema anlegen, umbenennen oder löschen (offene To-dos wandern in ein anderes Thema). */
function SectionDialog({
  projectId,
  section,
  sections,
  tasks,
  onClose,
}: {
  projectId: string;
  section: TaskSection | "new" | null;
  sections: TaskSection[];
  tasks: Task[];
  onClose: () => void;
}) {
  const toast = useToast();
  const editing = section && section !== "new" ? section : null;
  const [name, setName] = useState(editing?.name ?? "");
  const others = sections.filter((s) => s.id !== editing?.id);
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const affected = editing ? tasks.filter((t) => t.section_id === editing.id) : [];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast("Name fehlt", "error");
    setBusy("save");
    try {
      if (editing) await updateRow<TaskSection>("task_sections", editing.id, { name: name.trim() });
      else await createRow<TaskSection>("task_sections", { project_id: projectId, name: name.trim(), position: (sections.at(-1)?.position ?? 0) + 1 });
      onClose();
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!editing) return;
    setBusy("delete");
    try {
      for (const task of affected) await updateRow<Task>("tasks", task.id, { section_id: target });
      await deleteRow("task_sections", editing.id);
      onClose();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog open={!!section} onClose={onClose} title={editing ? "Thema bearbeiten" : "Neues Thema"}>
      {confirm && editing ? (
        <div className="grid gap-4">
          <p className="text-sm text-snow/70">
            „{editing.name}“ wird gelöscht.
            {affected.length > 0 && ` ${affected.length} To-do${affected.length === 1 ? "" : "s"} wandern nach:`}
          </p>
          {affected.length > 0 && (
            <Select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Zielthema">
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Zurück
            </Button>
            <Button variant="danger" onClick={remove} loading={busy === "delete"} loadingText="Wird gelöscht …">
              Löschen
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={save} className="grid gap-4">
          <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="z. B. JourFix" />}</Field>
          <div className="flex items-center gap-2">
            {editing && (
              <Button
                variant="ghost"
                className="text-error"
                icon={<Trash2 className="h-4 w-4" />}
                disabled={affected.length > 0 && others.length === 0}
                title={affected.length > 0 && others.length === 0 ? "Letztes Thema mit To-dos kann nicht gelöscht werden" : undefined}
                onClick={() => setConfirm(true)}
              >
                Löschen
              </Button>
            )}
            <Button variant="ghost" className="ml-auto" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" loading={busy === "save"} loadingText="Wird gespeichert …">
              {editing ? "Speichern" : "Anlegen"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Farbe">
      {PROJECT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={clsx("h-7 w-7 rounded-full ring-offset-2 ring-offset-sky transition-shadow", value === color && "ring-2 ring-snow")}
          style={{ background: color }}
        />
      ))}
    </div>
  );
}

function ProjectDialog({ open, project, onClose }: { open: boolean; project: TaskProject; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast("Name fehlt", "error");
    setBusy(true);
    try {
      await updateRow<TaskProject>("task_projects", project.id, { name: name.trim(), color });
      onClose();
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Kunde bearbeiten">
      <form onSubmit={save} className="grid gap-4">
        <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <div>
          <p className="mb-2 text-xs font-medium text-snow/60">Farbe</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird gespeichert …">
            Speichern
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
