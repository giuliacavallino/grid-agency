"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth";
import { useRows } from "@/lib/data";
import { byDue, today, type Task, type TaskProject, type TaskSection } from "@/lib/tasks";
import { Empty, Select, Spinner } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { usePeople } from "./project-board";
import { DoneToggle, TaskMeta, TaskSheet } from "./task";

function inDays(days: number) {
  const d = new Date(`${today()}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const GROUPS = [
  { id: "late", label: "Überfällig", test: (due: string | null) => !!due && due < today() },
  { id: "today", label: "Heute", test: (due: string | null) => due === today() },
  { id: "week", label: "Nächste 7 Tage", test: (due: string | null) => !!due && due > today() && due <= inDays(7) },
  { id: "later", label: "Später", test: (due: string | null) => !!due && due > inDays(7) },
  { id: "none", label: "Ohne Datum", test: (due: string | null) => !due },
];

/** Alle offenen To-dos einer Person über alle aktiven Kunden, nach Fälligkeit. */
export function MyTasks() {
  const auth = useAuth();
  const projects = useRows<TaskProject>("task_projects");
  const sections = useRows<TaskSection>("task_sections");
  const tasks = useRows<Task>("tasks");
  const people = usePeople(tasks.data);
  const me = auth.status === "signed-in" ? auth.account.name : "";
  const [person, setPerson] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Im Konto heißt man evtl. anders als in den To-dos (z. B. ohne Nachnamen)
  const first = me.split(" ")[0]?.toLowerCase();
  const self = people.find((p) => p.toLowerCase() === me.toLowerCase()) ?? people.find((p) => !!first && p.split(" ")[0].toLowerCase() === first) ?? me;
  const who = person ?? self;

  const active = useMemo(() => new Map((projects.data ?? []).filter((p) => !p.archived).map((p) => [p.id, p])), [projects.data]);
  const mine = useMemo(
    () => (tasks.data ?? []).filter((t) => !t.done && active.has(t.project_id) && (who ? t.assignee === who : !t.assignee)).sort(byDue),
    [tasks.data, active, who]
  );

  const open = tasks.data?.find((t) => t.id === openId);
  const error = projects.error ?? sections.error ?? tasks.error;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Meine To-dos" meta={tasks.data && `${mine.length} offen`}>
        <Select value={who} onChange={(e) => setPerson(e.target.value)} aria-label="Person" className="h-9 w-auto max-w-56">
          {[...new Set([self, ...people])].filter(Boolean).map((p) => (
            <option key={p} value={p}>
              {p === self ? `${p} (ich)` : p}
            </option>
          ))}
          <option value="">Niemand zugewiesen</option>
        </Select>
      </PageBar>

      {error ? (
        <Empty title="Aufgaben konnten nicht geladen werden" text={error.message} />
      ) : projects.loading || tasks.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : mine.length === 0 ? (
        <Empty title="Nichts offen" text="Hier erscheinen alle To-dos, die dir zugewiesen sind." />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {GROUPS.map((group) => {
              const list = mine.filter((t) => group.test(t.due_on));
              if (!list.length) return null;
              return (
                <section key={group.id}>
                  <h2 className={clsx("mb-2 px-1 text-[13px] font-medium", group.id === "late" ? "text-error" : "text-snow/60")}>
                    {group.label} <span className="text-snow/40">{list.length}</span>
                  </h2>
                  <ul className="overflow-hidden rounded-2xl border border-snow/[0.08] bg-surface">
                    {list.map((task) => (
                      <li key={task.id} className="border-b border-snow/[0.06] last:border-0">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setOpenId(task.id)}
                          onKeyDown={(e) => e.key === "Enter" && setOpenId(task.id)}
                          className="cursor-pointer px-4 py-3 hover:bg-snow/[0.03]"
                        >
                          <div className="flex items-start gap-2">
                            <DoneToggle task={task} className="mt-px" />
                            <p className={clsx("min-w-0 flex-1 text-[14px] leading-snug", task.done && "text-snow/45 line-through")}>{task.title}</p>
                          </div>
                          <TaskMeta task={{ ...task, assignee: null }} project={active.get(task.project_id)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <TaskSheet
        task={open}
        project={open && active.get(open.project_id)}
        sections={(sections.data ?? []).filter((s) => s.project_id === open?.project_id).sort((a, b) => a.position - b.position)}
        people={people}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
