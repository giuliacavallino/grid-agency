"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import { cn as clsx } from "@/lib/cn";
import { useResource } from "@/lib/data";
import type { SocialAccount, Workspace } from "@/lib/marketing";
import { useCan } from "@/components/access";
import { Popover } from "@/components/ui";

// Kundenwelten: GRID selbst und jeder Kunde haben ihren eigenen Bereich im
// Hub (Kanäle, Posts, später Performance). Welche Welt gerade offen ist,
// merkt sich der Browser; ?welt=<id> in der Adresse wählt sie direkt.

export type WorkspaceSummary = Workspace & { accounts: SocialAccount[]; scheduled: number };

export const URL_WORKSPACES = "/api/marketing/workspaces";
const KEY = "intranet:welt";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCurrentWorkspace(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useWorkspaces() {
  const can = useCan("marketing");
  return useResource<WorkspaceSummary[]>(can ? URL_WORKSPACES : null);
}

/** Aktuelle Kundenwelt (Standard: GRID selbst) */
export function useCurrentWorkspace() {
  const { data } = useWorkspaces();
  const stored = useSyncExternalStore(subscribe, read, () => null);

  // ?welt=<id> aus Links (z. B. nach dem Verbinden) übernehmen
  useEffect(() => {
    const welt = new URLSearchParams(window.location.search).get("welt");
    if (welt && welt !== read()) setCurrentWorkspace(welt);
  }, []);

  const current = data?.find((w) => w.id === stored) ?? data?.find((w) => w.kind === "agency") ?? data?.[0] ?? null;
  const select = useCallback((id: string) => setCurrentWorkspace(id), []);
  return { workspace: current, workspaces: data ?? [], select };
}

export function WorkspaceDot({ color, className }: { color: string; className?: string }) {
  return <span className={clsx("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

/** Logo der Kundenwelt (CI), sonst ein Punkt in ihrer Farbe */
export function WorkspaceLogo({ workspace, size = 20, wide = false }: { workspace: Pick<Workspace, "logo_url" | "color" | "name">; size?: number; wide?: boolean }) {
  if (!workspace.logo_url) return <WorkspaceDot color={workspace.color} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Logo aus dem Storage
    <img
      src={workspace.logo_url}
      alt={workspace.name}
      width={size}
      height={size}
      className="shrink-0 rounded-md bg-white object-contain"
      // wide: Querformat-Logos in voller Breite (z. B. Überschrift im Hub)
      style={{ height: size, width: wide ? "auto" : size, maxWidth: wide ? size * 4 : size, padding: wide ? 4 : 0, boxShadow: `0 0 0 1.5px ${workspace.color}` }}
    />
  );
}

/** Farbstreifen und Schimmer in der CI der Kundenwelt: man sieht immer, für
 * welchen Kunden man gerade arbeitet (bei GRID selbst unsichtbar) */
export function WorkspaceAccent() {
  const { workspace } = useCurrentWorkspace();
  if (workspace?.kind !== "customer") return null;
  const second = workspace.secondary_color ?? workspace.color;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[45] h-1" style={{ background: `linear-gradient(90deg, ${workspace.color}, ${second})` }} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-48 opacity-[0.10]"
        style={{ background: `radial-gradient(60% 100% at 50% 0%, ${workspace.color}, transparent)` }}
      />
    </>
  );
}

/** Auswahl der Kundenwelt, z. B. oben im Hub oder im Marketing */
export function WorkspaceSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { workspace, workspaces, select } = useCurrentWorkspace();
  if (!workspace) return null;
  const agency = workspaces.filter((w) => w.kind === "agency");
  const customers = workspaces.filter((w) => w.kind === "customer");
  return (
    <Popover
      align="left"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Kundenwelt wechseln"
          className={clsx(
            "flex h-9 max-w-[220px] items-center gap-2 rounded-full border bg-snow/[0.06] pr-2.5 pl-2.5 text-[13.5px] font-medium transition-colors hover:bg-snow/[0.12]",
            className
          )}
          style={{ borderColor: workspace.kind === "customer" ? workspace.color : "color-mix(in srgb, var(--color-snow) 12%, transparent)" }}
        >
          <WorkspaceLogo workspace={workspace} />
          {!compact && <span className="truncate">{workspace.name}</span>}
          <ChevronDown className="h-4 w-4 shrink-0 text-snow/60" />
        </button>
      )}
    >
      {(close) => (
        <div className="w-64 p-1.5">
          {[...agency, ...customers].map((w, index) => (
            <div key={w.id}>
              {index === agency.length && customers.length > 0 && (
                <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-wide text-snow/45 uppercase">Kunden</p>
              )}
              <button
                type="button"
                onClick={() => {
                  select(w.id);
                  close();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[14px] hover:bg-snow/[0.08]"
              >
                <WorkspaceLogo workspace={w} />
                <span className="flex-1 truncate">{w.name}</span>
                {w.id === workspace.id && <Check className="h-4 w-4 text-snow/70" />}
              </button>
            </div>
          ))}
          <Link
            href="/marketing?neu=1"
            onClick={close}
            className="mt-1 flex items-center gap-2.5 rounded-xl border-t border-snow/[0.08] px-2.5 py-2 text-[13px] text-snow/65 hover:bg-snow/[0.08] hover:text-snow"
          >
            <Plus className="h-4 w-4" /> Neue Kundenwelt
          </Link>
        </div>
      )}
    </Popover>
  );
}
