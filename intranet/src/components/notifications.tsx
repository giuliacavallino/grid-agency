"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, Bot, Briefcase, CalendarRange, CircleCheck, ListChecks, LoaderCircle, PhoneCall, UserPlus, Video, type LucideIcon } from "lucide-react";
import type { NotificationItem, NotificationKind } from "@/app/api/benachrichtigungen/route";
import { cn } from "@/lib/cn";
import { useResource } from "@/lib/data";
import { accentFill, accentText } from "@/lib/theme";
import { Button, Popover } from "./ui";

// Glocke in der Kopfzeile: Leads, Freigaben, Agent-Ergebnisse, fällige
// To-dos, Bewerbungen und heutige Calls. „Gesehen“ merkt sich der Browser
// als Zeitpunkt; was danach kam, zählt als neu.

const ENDPOINT = "/api/benachrichtigungen";
const REFRESH_MS = 2 * 60_000;
const SEEN_KEY = "intranet:notifications-seen";

const KINDS: Record<NotificationKind, { label: string; icon: LucideIcon; color: string }> = {
  lead: { label: "Lead", icon: UserPlus, color: "#3e9fd6" },
  nachfassen: { label: "Nachfassen", icon: PhoneCall, color: "#e5484d" },
  freigabe: { label: "Freigabe", icon: CircleCheck, color: "#30a46c" },
  agent: { label: "Agent", icon: Bot, color: "#9085e9" },
  aufgabe: { label: "Aufgabe", icon: ListChecks, color: "#f5a524" },
  bewerbung: { label: "Bewerbung", icon: Briefcase, color: "#f06ba5" },
  termin: { label: "Termin", icon: Video, color: "#6366f1" },
  postingplan: { label: "Postingplan", icon: CalendarRange, color: "#d9822b" },
};

// ---------- Gesehen-Zeitpunkt (localStorage) ----------

const seenListeners = new Set<() => void>();

function readSeen() {
  try {
    const value = Number(window.localStorage.getItem(SEEN_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeSeen(at: number) {
  try {
    window.localStorage.setItem(SEEN_KEY, String(at));
  } catch {
    // Ohne Speicher gilt „gesehen“ nur bis zum Neuladen
  }
  memorySeen = at;
  seenListeners.forEach((listener) => listener());
}

let memorySeen = 0;

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  const onStorage = (event: StorageEvent) => event.key === SEEN_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    seenListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const seenSnapshot = () => Math.max(readSeen(), memorySeen);
/** Auf dem Server (und vor dem Hydrieren) ist nichts neu */
const seenServerSnapshot = () => Infinity;

/** Ab wann ein Eintrag als neu gilt: Termine ab ihrem Tag, damit ein Call
 * um 15 Uhr nach dem Öffnen am Morgen nicht neu bleibt. */
function since(item: NotificationItem) {
  const at = Date.parse(item.at);
  if (item.kind !== "termin") return at;
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

// ---------- Zeit ----------

const dayDiff = (at: number, now: number) => {
  const a = new Date(at);
  const b = new Date(now);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

/** „vor 5 Min.“, „vor 3 Std.“, „gestern“, „vor 4 Tagen“, „12.10.“; Termine mit Uhrzeit */
function timeLabel(item: NotificationItem, now: number) {
  const at = Date.parse(item.at);
  if (item.kind === "termin") {
    return new Date(at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  const days = dayDiff(at, now);
  if (item.kind === "aufgabe" || item.kind === "nachfassen" || days > 0) {
    if (days <= 0) return "heute";
    if (days === 1) return "gestern";
    if (days < 7) return `vor ${days} Tagen`;
    return new Date(at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  return `vor ${Math.round(minutes / 60)} Std.`;
}

// ---------- Glocke ----------

export function NotificationBell() {
  const { data, error, loading, reload } = useResource<{ items: NotificationItem[] }>(ENDPOINT);
  const seen = useSyncExternalStore(subscribeSeen, seenSnapshot, seenServerSnapshot);
  // Was beim Öffnen neu war, bleibt hervorgehoben, bis man „Alle gelesen“ drückt
  const [highlightAfter, setHighlightAfter] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      reload();
      setNow(Date.now());
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  const items = data?.items ?? [];
  const unseen = items.filter((item) => since(item) > seen).length;

  const onToggle = useCallback(
    (open: boolean, toggle: () => void) => {
      if (!open) {
        setHighlightAfter(seen);
        setNow(Date.now());
        writeSeen(Date.now());
        reload();
      }
      toggle();
    },
    [seen, reload]
  );

  const retry = async () => {
    setRetrying(true);
    await reload();
    setRetrying(false);
  };

  const markAll = () => {
    writeSeen(Date.now());
    setHighlightAfter(Date.now());
  };

  return (
    <Popover
      className="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={() => onToggle(open, toggle)}
          aria-label={unseen ? `Benachrichtigungen, ${unseen} neu` : "Benachrichtigungen"}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-snow/[0.08] bg-surface text-snow/80 shadow-[0_2px_10px_var(--shadow-color)] transition-colors hover:bg-snow/[0.06] hover:text-snow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden />
          {unseen > 0 && (
            <span
              className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] leading-none font-semibold ring-2 ring-sky"
              style={{ background: "#c0392b", color: "#fff" }}
              aria-hidden
            >
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div role="dialog" aria-label="Benachrichtigungen">
          <div className="flex items-center justify-between gap-3 border-b border-snow/[0.08] px-4 py-3">
            <h2 className="text-[15px] font-semibold text-snow">Benachrichtigungen</h2>
            {items.length > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="rounded-full px-2 py-1 text-[13px] text-snow/60 hover:bg-snow/[0.08] hover:text-snow"
              >
                Alle gelesen
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-1.5">
            {loading && !data ? (
              <p className="flex items-center gap-2 px-3 py-6 text-[13px] text-snow/55" aria-busy>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                Wird geladen…
              </p>
            ) : error && !data ? (
              <div className="flex flex-col items-start gap-2 px-3 py-5">
                <p className="text-[13px] text-snow/60">Konnte nicht geladen werden.</p>
                <Button size="sm" variant="secondary" onClick={retry} loading={retrying} loadingText="Wird geladen…">
                  Erneut versuchen
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <CircleCheck className="h-6 w-6 text-snow/35" aria-hidden />
                <p className="text-[13.5px] font-medium text-snow/70">Alles erledigt</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <Entry item={item} now={now} fresh={highlightAfter !== null && since(item) > highlightAfter} onNavigate={close} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

function Entry({ item, now, fresh, onNavigate }: { item: NotificationItem; now: number; fresh: boolean; onNavigate: () => void }) {
  const kind = KINDS[item.kind];
  const Icon = kind.icon;
  const external = /^https?:\/\//.test(item.href);
  const className = cn(
    "flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-snow/[0.06]",
    fresh && "bg-snow/[0.045]"
  );
  const content = (
    <>
      <span
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{ background: accentFill(kind.color, 16), color: accentText(kind.color) }}
        title={kind.label}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-snow">{item.title}</span>
          <span className="shrink-0 text-[11.5px] text-snow/45 tabular-nums">{timeLabel(item, now)}</span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-snow/60">{item.text}</span>
      </span>
      {fresh && <span className="mt-2 h-2 w-2 shrink-0 rounded-full" style={{ background: "#c0392b" }} aria-label="Neu" />}
    </>
  );
  if (external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} onClick={onNavigate}>
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} className={className} onClick={onNavigate}>
      {content}
    </Link>
  );
}
