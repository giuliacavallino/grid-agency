"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, CalendarDays, LayoutDashboard, ListChecks, Menu, Palette, Settings, Sparkles, Video, X, type LucideIcon } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { useResource } from "@/lib/data";
import { hasArea } from "@/lib/access";
import type { PostIdea } from "@/lib/marketing";
import type { Task } from "@/lib/tasks";
import { accentText } from "@/lib/theme";
import { useMe } from "@/components/access";
import { AccountMenu } from "@/components/hub";
import { TeamsButton } from "@/components/teams";
import { TopBar } from "@/components/topbar";
import { Empty, Spinner } from "@/components/ui";
import { AkteWorkspace, useWorkspaces, WorkspaceLogo, type WorkspaceSummary } from "@/components/marketing/workspace";

// Kundenakte: alles zu einem Kunden an einem Ort – Cockpit, Aufgaben (auch
// aus Calls), Content-Vorschläge, Redaktionsplanung, CI-Vorgaben für den
// Agenten und unten die Einstellungen mit allen Anbindungen. Die Akte trägt
// Farben und Logo des Kunden; gewechselt wird nur über die Übersicht.

type Item = { path: string; label: string; icon: LucideIcon; area: string; count?: number; alert?: boolean };

export const akteUrl = (id: string, path = "") => `/akte/${id}${path ? `/${path}` : ""}`;

function useCounts(workspace: WorkspaceSummary | null) {
  const me = useMe();
  const aufgaben = hasArea(me.data, "aufgaben");
  const marketing = hasArea(me.data, "marketing");
  // Gleiche Adressen wie die Aufgaben-Ansichten: ein gemeinsamer Cache
  const tasks = useResource<Task[]>(aufgaben && workspace?.project_id ? "/api/sales/tasks" : null);
  const proposals = useResource<{ status: string; project_id: string | null }[]>(aufgaben ? "/api/sales/meeting_tasks" : null);
  const ideas = useResource<PostIdea[]>(marketing && workspace ? `/api/marketing/ideas?workspace=${workspace.id}` : null);
  const open = (tasks.data ?? []).filter((t) => t.project_id === workspace?.project_id && !t.done);
  return {
    tasks: open.length,
    review: open.filter((t) => t.agent_status === "review" || t.agent_status === "failed").length,
    calls: (proposals.data ?? []).filter((p) => p.status === "vorschlag" && p.project_id && p.project_id === workspace?.project_id).length,
    ideas: (ideas.data ?? []).filter((i) => i.status === "new").length,
  };
}

function NavLink({ item, href, active, color, onNavigate }: { item: Item; href: string; active: boolean; color: string; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "relative flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors",
        active ? "bg-snow/[0.1] font-medium text-snow" : "text-snow/65 hover:bg-snow/[0.05] hover:text-snow"
      )}
    >
      {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full" style={{ background: color }} />}
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count ? (
        <span
          className={clsx("min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums", item.alert ? "text-white" : "bg-snow/[0.1] text-snow/75")}
          style={item.alert ? { background: color } : undefined}
        >
          {item.count}
        </span>
      ) : null}
    </Link>
  );
}

function Sidebar({ workspace, onNavigate }: { workspace: WorkspaceSummary; onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const counts = useCounts(workspace);
  const base = akteUrl(workspace.id);
  const color = workspace.color;

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Arbeiten",
      items: [
        { path: "", label: "Cockpit", icon: LayoutDashboard, area: "marketing" },
        { path: "aufgaben", label: "Aufgaben", icon: ListChecks, area: "aufgaben", count: counts.review || counts.tasks, alert: counts.review > 0 },
        { path: "calls", label: "Calls & To-dos", icon: Video, area: "aufgaben", count: counts.calls, alert: counts.calls > 0 },
      ],
    },
    {
      title: "Content",
      items: [
        { path: "vorschlaege", label: "Vorschläge", icon: Sparkles, area: "marketing", count: counts.ideas, alert: counts.ideas > 0 },
        ...(workspace.planning === false ? [] : [{ path: "planung", label: "Planung", icon: CalendarDays, area: "marketing" } as Item]),
        { path: "ci", label: "Markenkit", icon: Palette, area: "marketing" },
      ],
    },
  ];
  const isActive = (path: string) => (path ? pathname.startsWith(`${base}/${path}`) : pathname === base);
  const settings: Item = { path: "einstellungen", label: "Einstellungen", icon: Settings, area: "marketing" };

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="mb-4 inline-flex h-8 items-center gap-1 self-start rounded-full border border-snow/[0.1] bg-surface px-3 text-[13px] font-medium text-snow/75 shadow-[0_2px_8px_var(--shadow-color)] hover:text-snow">
        <ArrowLeft className="h-3.5 w-3.5" /> Hub
      </Link>

      {/* Kunde: rundes Profilbild wie bei Instagram, Ring im GRID-Verlauf */}
      <div className="mb-5 rounded-2xl border border-snow/[0.08] bg-panel p-3.5">
        <div className="group flex items-center gap-3">
          <WorkspaceLogo workspace={workspace} size={46} box />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{workspace.name}</p>
            <p className="text-[11.5px] tracking-wide text-snow/50 uppercase">{workspace.kind === "agency" ? "Eigene Marke" : "Kundenakte"}</p>
          </div>
        </div>
      </div>

      <nav aria-label={workspace.name} className="-mx-1 flex-1 overflow-y-auto px-1">
        {groups.map((group) => {
          const items = group.items.filter((item) => hasArea(me.data, item.area));
          if (!items.length) return null;
          return (
            <div key={group.title} className="mb-4">
              <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wide text-snow/40 uppercase">{group.title}</p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.path}>
                    <NavLink item={item} href={item.path ? `${base}/${item.path}` : base} active={isActive(item.path)} color={color} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="mt-3 flex flex-col gap-0.5 border-t border-snow/[0.08] pt-3">
        {hasArea(me.data, "marketing") && <NavLink item={settings} href={`${base}/einstellungen`} active={isActive("einstellungen")} color={color} onNavigate={onNavigate} />}
        <TeamsButton label className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] text-snow/65 hover:bg-snow/[0.05] hover:text-snow" />
        <div className="mt-2 px-1.5">
          <AccountMenu align="left" />
        </div>
      </div>
    </div>
  );
}

export function AkteShell({ id, children }: { id: string; children: React.ReactNode }) {
  const workspaces = useWorkspaces();
  const [drawer, setDrawer] = useState(false);
  const workspace = workspaces.data?.find((w) => w.id === id) ?? null;

  if (workspaces.error) return <Empty title="Kundenakte konnte nicht geladen werden" text={workspaces.error.message} />;
  if (!workspace) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas">
        {workspaces.loading ? <Spinner /> : <Empty title="Kundenakte nicht gefunden" text="Bitte über die Übersicht einen Kunden wählen." />}
      </div>
    );
  }

  return (
    <AkteWorkspace.Provider value={workspace.id}>
      <div className="flex h-dvh overflow-hidden bg-canvas" style={{ ["--akte" as string]: workspace.color, ["--akte-text" as string]: accentText(workspace.color) }}>
        <aside className="hidden w-[256px] shrink-0 flex-col border-r border-snow/[0.08] bg-sky px-3 py-4 md:flex">
          <Sidebar workspace={workspace} />
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-snow/[0.08] bg-sky px-2 md:hidden">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Menü öffnen" className="grid h-9 w-9 place-items-center rounded-lg text-snow/80 hover:bg-snow/10">
              <Menu className="h-5 w-5" />
            </button>
            <WorkspaceLogo workspace={workspace} size={28} box />
            <span className="flex-1 truncate text-[15px] font-medium">{workspace.name}</span>
            <TeamsButton className="h-9 w-9" />
            <AccountMenu />
          </div>
          <TopBar className="hidden border-b border-snow/[0.06] md:flex" />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
        </div>

        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="animate-fade absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <aside className="animate-sheet absolute inset-y-0 left-0 flex w-72 flex-col bg-sky px-3 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 shadow-2xl">
              <button type="button" onClick={() => setDrawer(false)} aria-label="Menü schließen" className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-lg text-snow/70 hover:bg-snow/10">
                <X className="h-5 w-5" />
              </button>
              <Sidebar workspace={workspace} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}
      </div>
    </AkteWorkspace.Provider>
  );
}

export { AkteHeader } from "./header";
