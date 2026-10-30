"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/data";
import { euro } from "@/lib/format";
import type { Application, Invoice, Lead, Retainer } from "@/lib/sales/types";
import { isOverdue, type Task, type TaskProject } from "@/lib/tasks";
import { monthTotals } from "./sales/orderbook";
import { useCan } from "./access";

export type Kpi = { id: string; label: string; value: string; href: string; alert?: string };

/** Kennzahlen für die Kopfleiste der Übersicht, je nach freigegebenen
 * Bereichen. Dieselben URLs wie in den Bereichen, damit der Cache greift. */
export function useKpis(): Kpi[] | null {
  const auth = useAuth();
  const sales = useCan("sales");
  const finance = useCan("finance");
  const personal = useCan("personal");
  const aufgaben = useCan("aufgaben");

  const retainers = useResource<Retainer[]>(sales ? "/api/sales/retainers" : null);
  const leads = useResource<Lead[]>(sales ? "/api/sales/leads?status=offen" : null);
  const invoices = useResource<Invoice[]>(finance ? "/api/sales/invoices?stage=neu" : null);
  const applications = useResource<Application[]>(personal ? "/api/sales/applications?stage=neu" : null);
  const projects = useResource<TaskProject[]>(aufgaben ? "/api/sales/task_projects" : null);
  const tasks = useResource<Task[]>(aufgaben ? "/api/sales/tasks" : null);

  if (auth.status !== "signed-in") return null;
  const kpis: Kpi[] = [];

  if (sales) {
    kpis.push({ id: "mrr", label: "MRR", value: retainers.data ? euro(monthTotals(retainers.data).mrr) : "…", href: "/sales/auftragsbuch" });
    const open = (leads.data ?? []).filter((l) => l.status === "offen" && l.stage !== "gewonnen");
    kpis.push({
      id: "pipeline",
      label: "Pipeline",
      value: leads.data ? euro(open.reduce((sum, l) => sum + Number(l.value ?? 0), 0)) : "…",
      href: "/sales",
    });
    const fresh = open.filter((l) => l.stage === "neu").length;
    kpis.push({ id: "leads", label: "Neue Leads", value: leads.data ? String(fresh) : "…", href: "/sales", alert: fresh ? "neu" : undefined });
  }

  if (finance) {
    const count = invoices.data?.filter((i) => i.stage === "neu").length ?? 0;
    kpis.push({ id: "invoices", label: "Zur Freigabe", value: invoices.data ? String(count) : "…", href: "/finance", alert: count ? "offen" : undefined });
  }

  if (personal) {
    const count = applications.data?.filter((a) => a.stage === "neu").length ?? 0;
    kpis.push({ id: "applications", label: "Bewerbungen", value: applications.data ? String(count) : "…", href: "/personal", alert: count ? "neu" : undefined });
  }

  if (aufgaben) {
    // Im Konto heißt man evtl. anders als in den To-dos (z. B. ohne Nachnamen)
    const me = auth.account.name.toLowerCase();
    const first = me.split(" ")[0];
    const active = new Set((projects.data ?? []).filter((p) => !p.archived).map((p) => p.id));
    const mine = (tasks.data ?? []).filter((t) => {
      const who = t.assignee?.toLowerCase() ?? "";
      return !t.done && active.has(t.project_id) && (who === me || who.split(" ")[0] === first);
    });
    const overdue = mine.filter(isOverdue).length;
    kpis.push({
      id: "tasks",
      label: "Meine To-dos",
      value: tasks.data && projects.data ? String(mine.length) : "…",
      href: "/aufgaben/meine",
      alert: overdue ? `${overdue} überfällig` : undefined,
    });
  }

  return kpis;
}

/** Kennzahlen nebeneinander; Klick führt in den Bereich. */
export function KpiList({ kpis, className }: { kpis: Kpi[]; className?: string }) {
  return (
    <ul className={clsx("flex items-stretch", className)}>
      {kpis.map((kpi) => (
        <li key={kpi.id}>
          <Link
            href={kpi.href}
            className="group flex h-full flex-col justify-center rounded-2xl px-3 py-1 whitespace-nowrap transition-colors hover:bg-snow/[0.08]"
          >
            <span className="flex items-center gap-1.5 text-[10.5px] font-medium tracking-[0.08em] text-snow/55 uppercase">
              {kpi.label}
              {kpi.alert && <span className="h-1.5 w-1.5 rounded-full bg-[#fa7e1e]" aria-label={kpi.alert} title={kpi.alert} />}
            </span>
            <span className="text-[17px] leading-tight font-medium tabular-nums">{kpi.value}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
