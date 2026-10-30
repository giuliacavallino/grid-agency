"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth";
import { useRows } from "@/lib/data";
import { byDue, today, type Task, type TaskProject, type TaskSection } from "@/lib/tasks";
import { Empty, Select, Spinner } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { usePeople } from "./project";
import { TaskSheet } from "./task";
import { ListHeader, TaskRow } from "./task-list";

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
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          <ListHeader withProject />
          {GROUPS.map((group) => {
            const list = mine.filter((t) => group.test(t.due_on));
            if (!list.length) return null;
            return (
              <section key={group.id} className="pt-5">
                <h2 className={clsx("flex h-9 items-center gap-1.5 px-3 text-[15px] font-semibold md:px-8", group.id === "late" && "text-error")}>
                  {group.label} <span className="text-[13px] font-normal text-snow/40">{list.length}</span>
                </h2>
                <ul className="border-t border-snow/[0.06]">
                  {list.map((task) => (
                    <li key={task.id}>
                      <TaskRow task={task} people={people} onOpen={setOpenId} project={active.get(task.project_id)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
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
