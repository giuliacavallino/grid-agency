"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { FileText, Plus } from "lucide-react";
import { createRow, useRows } from "@/lib/data";
import { byDue, dueLabel, isOverdue, PROJECT_COLORS, type Task, type TaskProject, type TaskSection } from "@/lib/tasks";
import { Button, Dialog, Empty, Field, Input, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { ColorPicker } from "./project";
import { DoneToggle } from "./task";

/** Kacheln je Kunde: offene To-dos, Überfälliges, Themen und das Nächste. */
export function Overview({ archived = false }: { archived?: boolean }) {
  const projects = useRows<TaskProject>("task_projects");
  const sections = useRows<TaskSection>("task_sections");
  const tasks = useRows<Task>("tasks");
  const [creating, setCreating] = useState(false);

  const list = useMemo(
    () => (projects.data ?? []).filter((p) => p.archived === archived).sort((a, b) => (archived ? a.name.localeCompare(b.name) : a.position - b.position)),
    [projects.data, archived]
  );
  const open = useMemo(() => (tasks.data ?? []).filter((t) => !t.done), [tasks.data]);
  const overdue = open.filter((t) => isOverdue(t) && list.some((p) => p.id === t.project_id)).length;

  const error = projects.error ?? sections.error ?? tasks.error;
  const loading = projects.loading || sections.loading || tasks.loading;

  return (
    <div className="flex h-full flex-col">
      <PageBar
        title={archived ? "Archiv" : "Alle Kunden"}
        meta={
          !loading &&
          (archived ? (
            `${list.length} ehemalige Kunden · Briefings bleiben erhalten`
          ) : (
            <span>
              {open.filter((t) => list.some((p) => p.id === t.project_id)).length} offene To-dos
              {overdue > 0 && <span className="text-error"> · {overdue} überfällig</span>}
            </span>
          ))
        }
      >
        {!archived && (
          <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Neuer Kunde
          </Button>
        )}
      </PageBar>

      {error ? (
        <Empty title="Aufgaben konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <Empty title={archived ? "Archiv ist leer" : "Noch keine Kunden"} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((project) => (
              <ProjectTile
                key={project.id}
                project={project}
                sections={(sections.data ?? []).filter((s) => s.project_id === project.id).sort((a, b) => a.position - b.position)}
                tasks={open.filter((t) => t.project_id === project.id)}
                archived={archived}
              />
            ))}
          </div>
        </div>
      )}

      <NewProjectDialog open={creating} onClose={() => setCreating(false)} nextPosition={(list.at(-1)?.position ?? 0) + 1} />
    </div>
  );
}

function ProjectTile({ project, sections, tasks, archived }: { project: TaskProject; sections: TaskSection[]; tasks: Task[]; archived: boolean }) {
  const late = tasks.filter(isOverdue).length;
  const next = [...tasks].sort(byDue).slice(0, 3);
  const perSection = sections.map((s) => ({ ...s, count: tasks.filter((t) => t.section_id === s.id).length })).filter((s) => s.count > 0);

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-snow/[0.08] bg-surface p-4 shadow-[0_1px_2px_var(--shadow-color)] transition-[border-color,transform] focus-within:border-snow/30 hover:-translate-y-px hover:border-snow/20">
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: project.color }} />
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-medium">
          {/* Die ganze Kachel ist klickbar, das Abhaken liegt darüber */}
          <Link href={`/aufgaben/${project.id}`} className="outline-none after:absolute after:inset-0">
            {project.name}
          </Link>
        </h2>
        {project.briefing && <FileText className="mt-1 h-4 w-4 shrink-0 text-snow/35" aria-label="mit Briefing" />}
      </div>

      {archived ? (
        <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-snow/55">{project.briefing ?? "Kein Briefing"}</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-snow/55">
            {tasks.length} offen
            {late > 0 && <span className="font-medium text-error"> · {late} überfällig</span>}
          </p>

          {perSection.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {perSection.slice(0, 6).map((s) => (
                <span key={s.id} className="rounded-full bg-snow/[0.06] px-2 py-0.5 text-[11.5px] text-snow/70">
                  {s.name} <span className="text-snow/40">{s.count}</span>
                </span>
              ))}
              {perSection.length > 6 && <span className="px-1 text-[11.5px] text-snow/40">+{perSection.length - 6}</span>}
            </div>
          )}

          {next.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-snow/[0.06] pt-3">
              {next.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-[13px]">
                  <DoneToggle task={task} className="relative z-10" />
                  <span className="min-w-0 flex-1 truncate text-snow/80">{task.title}</span>
                  {task.due_on && <span className={clsx("shrink-0 text-[12px]", isOverdue(task) ? "font-medium text-error" : "text-snow/45")}>{dueLabel(task.due_on)}</span>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

function NewProjectDialog({ open, onClose, nextPosition }: { open: boolean; onClose: () => void; nextPosition: number }) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast("Name fehlt", "error");
    setBusy(true);
    try {
      const project = await createRow<TaskProject>("task_projects", { name: name.trim(), color, position: nextPosition });
      await createRow<TaskSection>("task_sections", { project_id: project.id, name: "Allgemein", position: 1 });
      setName("");
      onClose();
      router.push(`/aufgaben/${project.id}`);
    } catch {
      toast("Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Neuer Kunde">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Name *">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <div>
          <p className="mb-2 text-xs font-medium text-snow/60">Farbe</p>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird angelegt …">
            Anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
