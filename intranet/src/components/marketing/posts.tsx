"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { POST_STATUS, type SocialAccount, type SocialPost } from "@/lib/marketing";
import { accentFill } from "@/lib/theme";
import { Button, Empty, IconButton, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { ProviderMark } from "./common";
import { PostEditor, postsUrl } from "./post-editor";
import { URL_WORKSPACES, useCurrentWorkspace, WorkspaceSwitcher } from "./workspace";

// Marketing → Posts & Planung: Redaktionskalender der aktuellen Kundenwelt.
// Links Entwürfe und Ideen ohne Termin, rechts Woche oder Monat. Posts lassen
// sich per Drag & Drop planen und verschieben; ein Klick öffnet den Editor.


const DAY = 86_400_000;
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const EDITABLE: SocialPost["status"][] = ["draft", "scheduled", "failed"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => {
  const day = startOfDay(d);
  return new Date(day.getTime() - ((day.getDay() + 6) % 7) * DAY);
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

/** Wann ein Post im Kalender steht: veröffentlicht → dann, sonst geplanter Termin */
const postDate = (p: SocialPost) => (p.status === "published" || p.status === "partial" ? p.published_at ?? p.scheduled_at : p.scheduled_at);

/** Neuer Termin am Tag `day` mit der Uhrzeit des alten Termins (sonst 18 Uhr) */
function moveTo(day: Date, previous: string | null) {
  const target = new Date(day);
  const old = previous ? new Date(previous) : null;
  target.setHours(old ? old.getHours() : 18, old ? old.getMinutes() : 0, 0, 0);
  return target;
}

type View = "week" | "month";
type Editing = { post: SocialPost | null; date?: Date } | null;

export function Posts() {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const url = workspace ? postsUrl(workspace.id) : null;
  const posts = useResource<SocialPost[]>(url);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [editing, setEditing] = useState<Editing>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = startOfWeek(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const count = Math.ceil((Math.round((last.getTime() - start.getTime()) / DAY) + 1) / 7) * 7;
    return Array.from({ length: count }, (_, i) => new Date(start.getTime() + i * DAY));
  }, [view, anchor]);

  const { byDay, ideas } = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    const loose: SocialPost[] = [];
    for (const post of posts.data ?? []) {
      const at = postDate(post);
      if (!at) {
        loose.push(post);
        continue;
      }
      const key = dayKey(new Date(at));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    for (const list of map.values()) list.sort((a, b) => (postDate(a) ?? "").localeCompare(postDate(b) ?? ""));
    loose.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return { byDay: map, ideas: loose };
  }, [posts.data]);

  if (!workspace || !url) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const accounts = workspace.accounts.filter((a) => a.provider !== "canva");
  const today = new Date();

  const label =
    view === "week"
      ? `${days[0].toLocaleDateString("de-DE", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}`
      : anchor.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const shift = (direction: -1 | 1) =>
    setAnchor((d) => (view === "week" ? new Date(d.getTime() + direction * 7 * DAY) : new Date(d.getFullYear(), d.getMonth() + direction, 1)));

  /** Verschieben per Drag & Drop: Tag (Uhrzeit bleibt) oder zurück zu den Ideen */
  async function drop(postId: string, day: Date | null) {
    setDragOver(null);
    const post = posts.data?.find((p) => p.id === postId);
    if (!post || !EDITABLE.includes(post.status)) return;
    const scheduled_at = day ? moveTo(day, post.scheduled_at).toISOString() : null;
    // Mit Kanälen wird ein Termin direkt geplant, ohne Termin wird es wieder Entwurf
    const status = day && post.account_ids.length ? "scheduled" : "draft";
    const optimistic = { ...post, scheduled_at, status } as SocialPost;
    mutate<SocialPost[]>(url!, (list) => list.map((p) => (p.id === postId ? optimistic : p)));
    try {
      const saved = await api<SocialPost>(`/api/marketing/posts/${postId}`, { method: "PATCH", body: JSON.stringify({ scheduled_at, status }) });
      mutate<SocialPost[]>(url!, (list) => list.map((p) => (p.id === postId ? saved : p)));
      revalidate(URL_WORKSPACES);
    } catch (error) {
      mutate<SocialPost[]>(url!, (list) => list.map((p) => (p.id === postId ? post : p)));
      toast(error instanceof Error ? error.message : "Verschieben fehlgeschlagen", "error");
    }
  }

  const dropZone = (key: string, day: Date | null) => ({
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(key);
    },
    onDragLeave: () => setDragOver((current) => (current === key ? null : current)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      void drop(e.dataTransfer.getData("text/post"), day);
    },
  });

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Posts & Planung" meta={workspace.name}>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <WorkspaceSwitcher />
        <div className="flex items-center rounded-full border border-snow/12 p-0.5">
          {(["week", "month"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={clsx("h-8 rounded-full px-3 text-[13px]", view === v ? "bg-snow text-sky" : "text-snow/65 hover:text-snow")}
            >
              {v === "week" ? "Woche" : "Monat"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Zurück" className="h-9 w-9" onClick={() => shift(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <Button size="sm" variant="ghost" className="h-9" onClick={() => setAnchor(new Date())}>
            Heute
          </Button>
          <IconButton label="Weiter" className="h-9 w-9" onClick={() => shift(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
        <span className="hidden min-w-40 text-[14px] font-medium lg:inline">{label}</span>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ post: null })}>
          Neuer Post
        </Button>
        </div>
      </PageBar>

      {posts.error ? (
        <Empty title="Posts konnten nicht geladen werden" text={posts.error.message} />
      ) : posts.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Entwürfe und Ideen ohne Termin */}
          <aside
            {...dropZone("ideas", null)}
            className={clsx(
              "flex shrink-0 flex-col border-snow/[0.08] md:w-64 md:border-r",
              dragOver === "ideas" && "bg-snow/[0.05]"
            )}
          >
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <Lightbulb className="h-4 w-4 text-snow/55" />
              <h2 className="flex-1 text-[14px] font-medium">Entwürfe & Ideen</h2>
              <span className="text-[12px] text-snow/50">{ideas.length}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto">
              {ideas.map((post) => (
                <PostCard key={post.id} post={post} accounts={accounts} onOpen={() => setEditing({ post })} wide />
              ))}
              <button
                type="button"
                onClick={() => setEditing({ post: null })}
                className="flex min-h-14 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-snow/20 px-3 text-[13px] text-snow/55 hover:border-snow/40 hover:text-snow md:w-full"
              >
                <Plus className="h-4 w-4" /> Idee
              </button>
              {!accounts.length && (
                <p className="hidden px-1 pt-2 text-[12px] leading-snug text-snow/50 md:block">
                  Noch kein Kanal verbunden. Unter „Kanäle“ einen Link für den Kunden erstellen.
                </p>
              )}
            </div>
          </aside>

          {/* Kalender */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className={clsx("shrink-0 grid-cols-7 border-b border-snow/[0.08]", view === "week" ? "hidden md:grid" : "grid")}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-[12px] font-medium text-snow/55">
                  {d}
                </div>
              ))}
            </div>
            {/* Woche: auf dem Handy Tage untereinander, ab Tablet sieben Spalten */}
            <div
              className={clsx(
                "grid min-h-0 flex-1 overflow-y-auto",
                view === "month" ? "grid-cols-7 auto-rows-[minmax(96px,1fr)] md:auto-rows-[minmax(120px,1fr)]" : "grid-cols-1 md:grid-cols-7 md:grid-rows-[minmax(100%,1fr)]"
              )}
            >
              {days.map((day) => {
                const key = dayKey(day);
                const list = byDay.get(key) ?? [];
                const isToday = sameDay(day, today);
                const outside = view === "month" && day.getMonth() !== anchor.getMonth();
                const past = day.getTime() < startOfDay(today).getTime();
                return (
                  <div
                    key={key}
                    {...dropZone(key, day)}
                    onClick={(e) => e.target === e.currentTarget && !past && setEditing({ post: null, date: moveTo(day, null) })}
                    className={clsx(
                      "group flex min-w-0 flex-col gap-1.5 border-r border-b border-snow/[0.06] p-1.5",
                      outside && "bg-snow/[0.02]",
                      past ? "cursor-default" : "cursor-copy",
                      dragOver === key && "bg-snow/[0.06]"
                    )}
                    style={isToday ? { background: accentFill(workspace.color, 8) } : undefined}
                  >
                    <div className="pointer-events-none flex items-center justify-between px-1">
                      <span
                        className={clsx(
                          "grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px]",
                          isToday ? "bg-snow font-semibold text-sky" : outside ? "text-snow/35" : "text-snow/70"
                        )}
                      >
                        {view === "week" ? (
                          <>
                            <span className="md:hidden">{day.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "short" })}</span>
                            <span className="hidden md:inline">{day.toLocaleDateString("de-DE", { day: "numeric", month: "short" })}</span>
                          </>
                        ) : (
                          day.getDate()
                        )}
                      </span>
                      {!past && <Plus className="h-3.5 w-3.5 text-snow/0 group-hover:text-snow/40" />}
                    </div>
                    {list.map((post) => (
                      <PostCard key={post.id} post={post} accounts={accounts} compact={view === "month"} onOpen={() => setEditing({ post })} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <PostEditor
          key={editing.post?.id ?? "neu"}
          post={editing.post}
          initialDate={editing.date}
          workspace={workspace}
          accounts={accounts}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function PostCard({ post, accounts, onOpen, compact = false, wide = false }: { post: SocialPost; accounts: SocialAccount[]; onOpen: () => void; compact?: boolean; wide?: boolean }) {
  const status = POST_STATUS[post.status];
  const at = postDate(post);
  const draggable = EDITABLE.includes(post.status);
  const image = post.media.find((m) => m.kind === "image" && m.url);
  const failed = Object.values(post.results).some((r) => r.status === "failed");
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/post", post.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      className={clsx(
        "flex w-full shrink-0 flex-col gap-1 overflow-hidden rounded-xl border bg-panel p-1.5 text-left shadow-sm transition-colors hover:border-snow/30",
        post.status === "draft" ? "border-dashed border-snow/20" : "border-snow/[0.08]",
        draggable && "cursor-grab active:cursor-grabbing",
        wide && "w-44 md:w-full"
      )}
      style={{ borderLeft: `3px solid ${status.color ?? "color-mix(in srgb, var(--color-snow) 25%, transparent)"}` }}
    >
      {!compact && image && (
        // eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage
        <img src={image.url} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" draggable={false} />
      )}
      <span className="flex items-center gap-1 text-[11px] text-snow/60">
        {at && <span className="font-medium text-snow/80 tabular-nums">{time(at)}</span>}
        <span className={clsx("truncate", failed && "text-error")}>{failed ? "Fehler" : status.label}</span>
        {post.media.some((m) => m.kind === "video") && <span>· Video</span>}
      </span>
      <span className={clsx("text-[12.5px] leading-snug text-snow/85", compact ? "line-clamp-1" : "line-clamp-2")}>{post.caption || "Ohne Text"}</span>
      {!compact && post.account_ids.length > 0 && (
        <span className="flex flex-wrap gap-0.5">
          {post.account_ids.map((id) => {
            const account = accounts.find((a) => a.id === id);
            return account ? <ProviderMark key={id} provider={account.provider} className="h-5 min-w-5 text-[9px]" /> : null;
          })}
        </span>
      )}
    </button>
  );
}
