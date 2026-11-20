"use client";

import { Archive, LayoutGrid, UserRound, Video } from "lucide-react";
import { useRows } from "@/lib/data";
import type { TaskProject } from "@/lib/tasks";
import { AreaShell, type NavItem } from "@/components/sales/shell";
import { useWorkspaces, WorkspaceLogo } from "@/components/marketing/workspace";

const FIXED: NavItem[] = [
  { href: "/aufgaben", label: "Alle Kunden", icon: LayoutGrid },
  { href: "/aufgaben/meine", label: "Meine To-dos", icon: UserRound },
  { href: "/aufgaben/calls", label: "Aus Calls", icon: Video, counter: "proposals" },
];

/** Seitenleiste der Aufgaben: Übersicht, eigene To-dos, je aktivem Kunden
 * ein Eintrag und das Archiv. */
export function AufgabenShell({ children }: { children: React.ReactNode }) {
  const { data: projects } = useRows<TaskProject>("task_projects");
  const workspaces = useWorkspaces();
  const active = (projects ?? []).filter((p) => !p.archived).sort((a, b) => a.position - b.position);
  const nav: NavItem[] = [
    ...FIXED,
    ...active.map((p, i) => {
      const workspace = workspaces.data?.find((w) => w.project_id === p.id);
      return {
        href: `/aufgaben/${p.id}`,
        label: p.name,
        color: p.color,
        // Rundes Profilbild der Kundenwelt, sonst der Farbpunkt
        avatar: workspace ? <WorkspaceLogo workspace={workspace} size={26} box /> : undefined,
        group: i === 0 ? "Kunden" : undefined,
      };
    }),
    { href: "/aufgaben/archiv", label: "Archiv", icon: Archive, group: "Ehemalige" },
  ];
  return (
    <AreaShell title="Aufgaben" nav={nav}>
      {children}
    </AreaShell>
  );
}
