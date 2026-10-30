"use client";

import { Archive, LayoutGrid, UserRound, Video } from "lucide-react";
import { useRows } from "@/lib/data";
import type { TaskProject } from "@/lib/tasks";
import { AreaShell, type NavItem } from "@/components/sales/shell";

const FIXED: NavItem[] = [
  { href: "/aufgaben", label: "Alle Kunden", icon: LayoutGrid },
  { href: "/aufgaben/meine", label: "Meine To-dos", icon: UserRound },
  { href: "/aufgaben/calls", label: "Aus Calls", icon: Video, counter: "proposals" },
];

/** Seitenleiste der Aufgaben: Übersicht, eigene To-dos, je aktivem Kunden
 * ein Eintrag und das Archiv. */
export function AufgabenShell({ children }: { children: React.ReactNode }) {
  const { data: projects } = useRows<TaskProject>("task_projects");
  const active = (projects ?? []).filter((p) => !p.archived).sort((a, b) => a.position - b.position);
  const nav: NavItem[] = [
    ...FIXED,
    ...active.map((p, i) => ({ href: `/aufgaben/${p.id}`, label: p.name, color: p.color, group: i === 0 ? "Kunden" : undefined })),
    { href: "/aufgaben/archiv", label: "Archiv", icon: Archive, group: "Ehemalige" },
  ];
  return (
    <AreaShell title="Aufgaben" nav={nav}>
      {children}
    </AreaShell>
  );
}
