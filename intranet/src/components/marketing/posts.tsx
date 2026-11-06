"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import type { Autopilot, PostIdea, SocialPost } from "@/lib/marketing";
import { isoDay } from "@/lib/marketing-days";
import { Button, Empty, Spinner, useToast } from "@/components/ui";
import { AkteHeader } from "@/components/akte/header";
import { ideasUrl } from "@/components/akte/ideas";
import { PostEditor, postsUrl } from "./post-editor";
import {
  addDays,
  AgentBar,
  awaitsApproval,
  CHANNEL_ORDER,
  ChannelChip,
  dayKey,
  EDITABLE,
  isoWeek,
  moveTo,
  postChannels,
  PostCard,
  postDate,
  sameDay,
  shortDate,
  startOfDay,
  startOfWeek,
  TODAY_ACCENT,
  weekday,
  type Channel,
} from "./planner-parts";
import { PlanProgress } from "./plan-progress";
import { DayChips, daysByDate, DaysButton, useDays } from "./planner-days";
import { URL_WORKSPACES, useCurrentWorkspace } from "./workspace";

// Planung: Redaktionskalender der Kundenwelt. Oben Kanal-Filter und
// Agentenleiste, darunter Woche (sieben Tagesspalten) oder Monat, unten die
// Posts ohne Termin. Posts lassen sich per Drag & Drop planen und
// verschieben; ein Klick öffnet den Editor.

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const pill = "bg-surface shadow-[0_1px_2px_var(--shadow-color),0_2px_8px_var(--shadow-color)]";

type View = "week" | "month";
type Editing = { post: SocialPost | null; date?: Date } | null;

export function Posts() {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const url = workspace ? postsUrl(workspace.id) : null;
  const posts = useResource<SocialPost[]>(url);
  const ideas = useResource<PostIdea[]>(workspace ? ideasUrl(workspace.id) : null);
  const autopilot = useResource<Autopilot>(workspace ? `/api/marketing/workspaces/${workspace.id}/autopilot` : null);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [editing, setEditing] = useState<Editing>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<Channel>>(() => new Set());
  const [approving, setApproving] = useState(false);

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const weeks = Math.ceil((Math.round((startOfDay(last).getTime() - start.getTime()) / 86_400_000) + 1) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  // Feiertage, Aktionstage und Kundentage im sichtbaren Zeitraum
  const marketingDays = useDays(workspace?.id ?? null, days[0], days[days.length - 1]);
  const dayMap = useMemo(() => daysByDate(marketingDays.data), [marketingDays.data]);

  const accountMap = useMemo(() => new Map((workspace?.accounts ?? []).map((a) => [a.id, a])), [workspace?.accounts]);
  const fromIdeas = useMemo(() => new Set((ideas.data ?? []).map((i) => i.post_id).filter((id): id is string => !!id)), [ideas.data]);

  const { byDay, loose, counts, channels, approvals } = useMemo(() => {
    const from = days[0].getTime();
    const to = addDays(days[days.length - 1], 1).getTime();
    const map = new Map<string, SocialPost[]>();
    const undated: SocialPost[] = [];
    const count = new Map<Channel, number>();
    const pending: SocialPost[] = [];
    const visible = (p: SocialPost) => postChannels(p, accountMap).some((c) => !hidden.has(c)) && (!approving || awaitsApproval(p));
    const tally = (p: SocialPost) => postChannels(p, accountMap).forEach((c) => count.set(c, (count.get(c) ?? 0) + 1));
    const today = startOfDay(new Date()).getTime();
    for (const post of posts.data ?? []) {
      if (awaitsApproval(post) && new Date(post.scheduled_at!).getTime() >= today) pending.push(post);
      const at = postDate(post);
      if (!at) {
        if (!approving) tally(post);
        if (visible(post)) undated.push(post);
        continue;
      }
      const time = new Date(at).getTime();
      if (time < from || time >= to) continue;
      tally(post);
      if (!visible(post)) continue;
      const key = dayKey(new Date(at));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    for (const list of map.values()) list.sort((a, b) => (postDate(a) ?? "").localeCompare(postDate(b) ?? ""));
    undated.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    // Chips: verbundene Kanäle immer, sonst die, auf denen Posts liegen
    const shown = CHANNEL_ORDER.filter((c) => (c !== "none" && workspace?.accounts.some((a) => a.provider === c)) || count.has(c) || hidden.has(c));
    pending.sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
    return { byDay: map, loose: undated, counts: count, channels: shown, approvals: pending };
  }, [posts.data, days, accountMap, hidden, approving, workspace?.accounts]);

  if (!workspace || !url) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const accounts = workspace.accounts.filter((a) => a.provider !== "canva");
  const today = new Date();
  const isWeek = view === "week";

  const range = isWeek
    ? `${days[0].toLocaleDateString("de-DE", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" })}`
    : anchor.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const shift = (direction: -1 | 1) =>
    setAnchor((d) => (view === "week" ? addDays(d, direction * 7) : new Date(d.getFullYear(), d.getMonth() + direction, 1)));

  const toggleChannel = (channel: Channel) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });

  /** Freigeben: nur Entwürfe mit Termin zeigen und zum ersten springen, falls nötig */
  function toggleApprovals() {
    if (approving) return setApproving(false);
    setApproving(true);
    const first = approvals[0]?.scheduled_at;
    if (!first) return;
    const at = new Date(first);
    const inRange = at >= days[0] && at < addDays(days[days.length - 1], 1);
    if (!inRange) setAnchor(at);
  }

  /** Verschieben per Drag & Drop: Tag (Uhrzeit bleibt) oder zurück zu „Ohne Termin“ */
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

  const chips = (day: Date, compact: boolean, align: "left" | "right") => (
    <DayChips days={dayMap.get(isoDay(day))} workspaceId={workspace.id} accounts={accounts} onOpenPost={(post) => setEditing({ post })} compact={compact} align={align} />
  );

  const card = (post: SocialPost, compact = false, className?: string) => (
    <PostCard key={post.id} post={post} accounts={accountMap} fromIdeas={fromIdeas} compact={compact} className={className} onOpen={() => setEditing({ post })} />
  );

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Planung" meta="Redaktionskalender: Entwürfe per Drag & Drop einplanen" />

      <div className="min-h-0 flex-1 overflow-y-auto bg-sky">
        <div className="flex flex-col gap-4 px-4 pt-4 pb-10 md:px-7 md:pt-5">
          {/* Kanäle links, Ansicht und Navigation rechts */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" role="group" aria-label="Kanäle filtern">
              {channels.map((c) => (
                <ChannelChip key={c} channel={c} count={counts.get(c) ?? 0} active={!hidden.has(c)} onToggle={() => toggleChannel(c)} />
              ))}
              {!accounts.length && <span className="text-[12.5px] text-snow/50">Noch kein Kanal verbunden. Unter „Kanäle“ einen Link für den Kunden erstellen.</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={clsx("flex items-center rounded-full p-1", pill)} role="group" aria-label="Ansicht">
                {(["week", "month"] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={clsx("h-7 rounded-full px-3.5 text-[13px] font-medium transition-colors", view === v ? "bg-snow text-sky" : "text-snow/60 hover:text-snow")}
                  >
                    {v === "week" ? "Woche" : "Monat"}
                  </button>
                ))}
              </div>
              <div className={clsx("flex h-9 items-center rounded-full", pill)} title={range}>
                <button type="button" aria-label={isWeek ? "Vorige Woche" : "Voriger Monat"} onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-full text-snow/60 hover:text-snow">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-14 text-center text-[13px] font-semibold tabular-nums" aria-live="polite">
                  {isWeek ? `KW ${isoWeek(days[0])}` : range}
                  <span className="sr-only"> ({range})</span>
                </span>
                <button type="button" aria-label={isWeek ? "Nächste Woche" : "Nächster Monat"} onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-full text-snow/60 hover:text-snow">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button type="button" onClick={() => setAnchor(new Date())} className={clsx("h-9 rounded-full px-4 text-[13px] font-medium hover:text-snow", pill)}>
                Heute
              </button>
              <DaysButton workspaceId={workspace.id} onJump={setAnchor} />
              <Button variant="primary" size="sm" className="h-9 px-4" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ post: null })}>
                Eigener Post
              </Button>
            </div>
          </div>

          <PlanProgress workspaceId={workspace.id} posts={posts.data ?? []} anchor={anchor} view={view} />

          <AgentBar
            workspaceId={workspace.id}
            accounts={accounts}
            ideas={ideas.data}
            autopilot={autopilot.data}
            approvals={approvals.length}
            approving={approving}
            onApprovals={toggleApprovals}
          />

          {posts.error ? (
            <Empty title="Posts konnten nicht geladen werden" text={posts.error.message} />
          ) : posts.loading ? (
            <div className="grid place-items-center py-24">
              <Spinner />
            </div>
          ) : (
            <>
              {isWeek ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                  {days.map((day, index) => {
                    const key = dayKey(day);
                    const list = byDay.get(key) ?? [];
                    const isToday = sameDay(day, today);
                    const past = day.getTime() < startOfDay(today).getTime();
                    const label = `${weekday(day)} ${shortDate(day)}`;
                    return (
                      <section
                        key={key}
                        {...dropZone(key, day)}
                        aria-label={label}
                        className={clsx(
                          "flex min-w-0 flex-col gap-2.5 rounded-3xl border-2 bg-surface p-2.5 shadow-[0_1px_2px_var(--shadow-color),0_4px_16px_var(--shadow-color)] transition-colors md:min-h-[32rem]",
                          !isToday && "border-transparent",
                          dragOver === key && "bg-panel ring-2 ring-snow/15"
                        )}
                        style={isToday ? { borderColor: TODAY_ACCENT } : undefined}
                      >
                        <header className="flex min-h-7 items-center gap-1 pl-1.5">
                          <h3 className="flex-1 text-[14px]">
                            <span className="font-semibold">{weekday(day)}</span> <span className="text-snow/45 tabular-nums">{shortDate(day)}</span>
                            {isToday && <span className="sr-only"> (heute)</span>}
                          </h3>
                          {!past && (
                            <button
                              type="button"
                              aria-label={`Post am ${label} anlegen`}
                              title="Post an diesem Tag anlegen"
                              onClick={() => setEditing({ post: null, date: moveTo(day, null) })}
                              className="grid h-7 w-7 place-items-center rounded-full text-snow/45 transition-colors hover:bg-snow/[0.08] hover:text-snow"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </header>
                        {chips(day, false, index >= 4 ? "right" : "left")}
                        {list.map((post) => card(post))}
                        {!list.length && <div className="hidden flex-1 md:block" aria-hidden />}
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-7 gap-2 px-1">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="px-1 text-[12px] font-semibold text-snow/50">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid auto-rows-[minmax(7rem,auto)] grid-cols-7 gap-2">
                    {days.map((day, index) => {
                      const key = dayKey(day);
                      const list = byDay.get(key) ?? [];
                      const isToday = sameDay(day, today);
                      const outside = day.getMonth() !== anchor.getMonth();
                      const past = day.getTime() < startOfDay(today).getTime();
                      const label = `${weekday(day)} ${shortDate(day)}`;
                      return (
                        <section
                          key={key}
                          {...dropZone(key, day)}
                          aria-label={label}
                          className={clsx(
                            "group flex min-w-0 flex-col gap-1 rounded-2xl border-2 bg-surface p-1.5 shadow-[0_1px_2px_var(--shadow-color),0_2px_10px_var(--shadow-color)] transition-colors",
                            !isToday && "border-transparent",
                            outside && "opacity-55",
                            dragOver === key && "bg-panel ring-2 ring-snow/15"
                          )}
                          style={isToday ? { borderColor: TODAY_ACCENT } : undefined}
                        >
                          <header className="flex min-h-6 items-center justify-between pl-1">
                            <span className={clsx("text-[12.5px] tabular-nums", isToday ? "font-semibold" : "text-snow/60")} style={isToday ? { color: TODAY_ACCENT } : undefined}>
                              {day.getDate()}
                              {day.getDate() === 1 && ` ${day.toLocaleDateString("de-DE", { month: "short" })}`}
                            </span>
                            {!past && (
                              <button
                                type="button"
                                aria-label={`Post am ${label} anlegen`}
                                onClick={() => setEditing({ post: null, date: moveTo(day, null) })}
                                className="grid h-6 w-6 place-items-center rounded-full text-snow/0 transition-colors group-hover:text-snow/45 hover:bg-snow/[0.08] hover:!text-snow focus-visible:text-snow"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </header>
                          {chips(day, true, index % 7 >= 4 ? "right" : "left")}
                          {list.map((post) => card(post, true))}
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Posts ohne Termin (Entwürfe, Vorschläge): hierher ziehen nimmt den Termin raus */}
              {!approving && (
                <section
                  {...dropZone("loose", null)}
                  aria-label="Ohne Termin"
                  className={clsx("flex flex-col gap-3 rounded-3xl p-2 pt-3 transition-colors md:flex-row md:gap-5", dragOver === "loose" && "bg-snow/[0.05] ring-2 ring-snow/15")}
                >
                  <h2 className="flex shrink-0 items-baseline gap-2 pt-1 pl-1 text-[11.5px] font-semibold tracking-[0.08em] whitespace-nowrap text-snow/45 uppercase md:w-28 md:flex-col md:gap-0.5">
                    Ohne Termin
                    <span className="font-medium tracking-normal normal-case tabular-nums">{!loose.length ? "Keine" : loose.length === 1 ? "1 Post" : `${loose.length} Posts`}</span>
                  </h2>
                  <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
                    {loose.map((post) => card(post))}
                    <button
                      type="button"
                      onClick={() => setEditing({ post: null })}
                      className="flex min-h-24 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-snow/20 text-[13px] text-snow/55 transition-colors hover:border-snow/40 hover:text-snow"
                    >
                      <Plus className="h-4 w-4" /> Idee ohne Termin
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>

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
