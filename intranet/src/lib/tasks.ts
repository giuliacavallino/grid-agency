// Aufgaben: je Kunde (bzw. Geschäftsführung) ein Board mit Themen als
// Spalten und To-dos als Karten.

export type TaskProject = {
  id: string;
  created_at: string;
  name: string;
  color: string;
  customer_id: string | null;
  position: number;
  archived: boolean;
  briefing: string | null;
};

export type TaskSection = {
  id: string;
  project_id: string;
  name: string;
  position: number;
};

export type ChecklistItem = { text: string; done: boolean };

export type Task = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  section_id: string | null;
  title: string;
  notes: string | null;
  done: boolean;
  done_at: string | null;
  assignee: string | null;
  due_on: string | null;
  checklist: ChecklistItem[];
  position: number;
};

/** Wer To-dos übernehmen kann (Auswahl „Zuständig“) */
export const TEAM = ["Giulia Cavallino", "Marine Eichner"];

/** Farben zur Auswahl für neue Kunden */
export const PROJECT_COLORS = ["#eda100", "#e5484d", "#f06ba5", "#d62976", "#9085e9", "#6366f1", "#3e9fd6", "#30a46c", "#afaaa0"];

/** Heute als yyyy-mm-dd in lokaler Zeit */
export function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const isOverdue = (task: Pick<Task, "done" | "due_on">) => !task.done && !!task.due_on && task.due_on < today();

/** „heute“, „morgen“, „31. Okt.“ */
export function dueLabel(due: string) {
  const now = today();
  if (due === now) return "heute";
  const tomorrow = new Date(`${now}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (due === tomorrow.toISOString().slice(0, 10)) return "morgen";
  const date = new Date(`${due}T12:00:00`);
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

/** Offene To-dos zuerst nach Fälligkeit, dann nach Reihenfolge im Board */
export const byDue = (a: Task, b: Task) =>
  (a.due_on ?? "9999") < (b.due_on ?? "9999") ? -1 : (a.due_on ?? "9999") > (b.due_on ?? "9999") ? 1 : b.position - a.position;
