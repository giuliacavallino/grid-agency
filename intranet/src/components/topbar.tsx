"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, ListChecks, Search, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { useResource } from "@/lib/data";
import { hasArea } from "@/lib/access";
import { AREAS } from "@/lib/areas";
import type { Application, Customer, Lead } from "@/lib/sales/types";
import type { Task } from "@/lib/tasks";
import { useMe, useTeam } from "@/components/access";
import { NotificationBell } from "@/components/notifications";
import { PersonAvatar } from "@/components/person";
import { useTeamsChat } from "@/components/teams";
import { TimeButton } from "@/components/time-tracker";

// Kopfzeile aller Bereiche: Suche (⌘K), Team (Teams-Chats), Zeiterfassung,
// eigene Aufgaben und Benachrichtigungen.

const pill = "flex h-10 items-center gap-2 rounded-full border border-snow/[0.08] bg-surface px-3.5 text-[14px] font-medium shadow-[0_2px_10px_var(--shadow-color)] transition-colors hover:bg-snow/[0.04]";

export function TopBar({ className }: { className?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("flex shrink-0 items-center gap-2 px-3 py-3 md:px-6", className)}>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="flex h-11 w-full max-w-[380px] items-center gap-2.5 rounded-full border border-snow/[0.08] bg-surface px-4 text-left text-[14.5px] text-snow/45 shadow-[0_2px_10px_var(--shadow-color)] hover:text-snow/60"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1">Suchen …</span>
        <kbd className="hidden rounded-md bg-snow/[0.07] px-1.5 py-0.5 font-sans text-[11.5px] font-semibold text-snow/55 sm:inline">⌘ K</kbd>
      </button>
      <span className="flex-1" />
      <TeamPill />
      <TimeButton />
      <TasksButton />
      <NotificationBell />
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

/** Team: Profilbilder der Kolleg*innen, öffnet die Teams-Chats */
function TeamPill() {
  const team = useTeam();
  const { open } = useTeamsChat();
  if (!team.length) return null;
  return (
    <button type="button" onClick={() => open()} className={cn(pill, "hidden pl-1.5 md:flex")} aria-label="Team-Chats öffnen">
      <span className="flex -space-x-2">
        {team.slice(0, 5).map((member) => (
          <PersonAvatar key={member.email} name={member.name} email={member.email} className="h-7 w-7 border-2 border-surface text-[10px]" />
        ))}
      </span>
      Team
      <span className="rounded-full bg-snow/[0.08] px-1.5 text-[12px] text-snow/60 tabular-nums">{team.length}</span>
    </button>
  );
}

/** Eigene offene Aufgaben (Zähler) */
function TasksButton() {
  const me = useMe();
  const can = hasArea(me.data, "aufgaben");
  const { data } = useResource<Task[]>(can ? "/api/sales/tasks" : null);
  if (!can) return null;
  const mine = (data ?? []).filter((t) => !t.done && t.assignee && (t.assignee === me.data?.name || t.assignee === me.data?.email)).length;
  return (
    <Link href="/aufgaben" aria-label={`Meine Aufgaben${mine ? ` (${mine} offen)` : ""}`} title="Meine Aufgaben" className="relative grid h-10 w-10 place-items-center rounded-full border border-snow/[0.08] bg-surface shadow-[0_2px_10px_var(--shadow-color)] hover:bg-snow/[0.04]">
      <ListChecks className="h-[18px] w-[18px]" strokeWidth={1.8} />
      {mine > 0 && (
        <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-snow px-1 text-[10.5px] font-semibold text-sky tabular-nums">{mine}</span>
      )}
    </Link>
  );
}

type Hit = { id: string; label: string; detail?: string; href: string; icon: LucideIcon; group: string };

/** Suche über Bereiche, Leads, Kunden, Aufgaben und Bewerbungen */
function SearchPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const me = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const can = (area: string) => hasArea(me.data, area);
  const leads = useResource<Lead[]>(can("sales") ? "/api/sales/leads" : null);
  const customers = useResource<Customer[]>(can("sales") ? "/api/sales/customers" : null);
  const tasks = useResource<Task[]>(can("aufgaben") ? "/api/sales/tasks" : null);
  const applications = useResource<Application[]>(can("personal") ? "/api/sales/applications" : null);

  useEffect(() => input.current?.focus(), []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (...values: (string | null | undefined)[]) => !q || values.some((v) => v?.toLowerCase().includes(q));
    const areas: Hit[] = AREAS.filter((a) => can(a.id) && match(a.title, a.text)).map((a) => ({ id: `area:${a.id}`, label: a.title, detail: a.text, href: a.href, icon: a.icon, group: "Bereiche" }));
    if (!q) return areas;
    const list: Hit[] = [
      ...areas,
      ...(customers.data ?? [])
        .filter((c) => match(c.name, c.contact_name, c.email, c.customer_number))
        .slice(0, 6)
        .map((c) => ({ id: `c:${c.id}`, label: c.name, detail: [c.customer_number, c.contact_name, c.email].filter(Boolean).join(" · "), href: "/sales/kunden", icon: Building2, group: "Kunden" })),
      ...(leads.data ?? [])
        .filter((l) => match(l.name, l.company, l.email))
        .slice(0, 6)
        .map((l) => ({ id: `l:${l.id}`, label: l.company || l.name, detail: [l.name, l.email].filter(Boolean).join(" · "), href: "/sales", icon: UserPlus, group: "Leads" })),
      ...(tasks.data ?? [])
        .filter((t) => !t.done && match(t.title, t.notes))
        .slice(0, 6)
        .map((t) => ({ id: `t:${t.id}`, label: t.title, detail: [t.assignee, t.due_on && new Date(t.due_on).toLocaleDateString("de-DE")].filter(Boolean).join(" · "), href: "/aufgaben", icon: ListChecks, group: "Aufgaben" })),
      ...(applications.data ?? [])
        .filter((a) => match(a.name, a.email, a.position_title))
        .slice(0, 6)
        .map((a) => ({ id: `a:${a.id}`, label: a.name, detail: [a.position_title, a.email].filter(Boolean).join(" · "), href: "/personal", icon: Briefcase, group: "Bewerbungen" })),
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- can() hängt nur an me.data
  }, [query, customers.data, leads.data, tasks.data, applications.data, me.data]);

  function go(hit: Hit | undefined) {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-3 pt-[12vh]" onClick={onClose}>
      <div role="dialog" aria-label="Suche" className="w-full max-w-xl overflow-hidden rounded-3xl border border-snow/[0.08] bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-snow/[0.08] px-5">
          <Search className="h-5 w-5 shrink-0 text-snow/45" />
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") (e.preventDefault(), setActive((i) => Math.min(i + 1, hits.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => Math.max(i - 1, 0)));
              else if (e.key === "Enter") go(hits[active]);
            }}
            placeholder="Kunde, Lead, Aufgabe, Bewerbung oder Bereich …"
            aria-label="Suchbegriff"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-snow/40"
          />
          <kbd className="rounded-md bg-snow/[0.07] px-1.5 py-0.5 font-sans text-[11px] font-semibold text-snow/50">esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {hits.length === 0 && <li className="px-3 py-8 text-center text-[14px] text-snow/50">Nichts gefunden</li>}
          {hits.map((hit, index) => (
            <li key={hit.id}>
              {(index === 0 || hits[index - 1].group !== hit.group) && (
                <p className="px-3 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-snow/45 uppercase">{hit.group}</p>
              )}
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(hit)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", index === active ? "bg-snow/[0.08]" : "hover:bg-snow/[0.05]")}
              >
                <hit.icon className="h-4 w-4 shrink-0 text-snow/60" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{hit.label}</span>
                  {hit.detail && <span className="block truncate text-[12.5px] text-snow/50">{hit.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
