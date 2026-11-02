"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, CalendarDays, CircleAlert, Link2, ListChecks, Plus, Rocket, Sparkles, Video } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { POST_STATUS, type Autopilot, type PostIdea, type SocialPost } from "@/lib/marketing";
import { AGENT_STATUS, isOverdue, type Task } from "@/lib/tasks";
import { accentFill } from "@/lib/theme";
import { useCan } from "@/components/access";
import { Button, IconButton, Spinner, useToast } from "@/components/ui";
import { ProviderMark } from "@/components/marketing/common";
import { PostEditor, postsUrl } from "@/components/marketing/post-editor";
import { useCurrentWorkspace, type WorkspaceSummary } from "@/components/marketing/workspace";
import { IdeaCard, IdeaComposer, ideasUrl } from "./ideas";
import { akteUrl, AkteHeader } from "./shell";

// Cockpit der Kundenakte: was heute zählt – Kennzahlen, To-dos (auch beim
// Agenten), Vorschläge, die Woche im Kalender, letzter Call und Autopilot.

type Recording = { id: string; created_at: string; meeting_id: string; status: string; summary: string | null };
type Proposal = { id: string; recording_id: string; status: string; project_id: string | null };

const DAY = 86_400_000;
const weekday = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const dayNum = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const clock = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });

function Card({ title, icon: Icon, href, action, children, className }: { title: string; icon: typeof Bot; href?: string; action?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("flex min-w-0 flex-col rounded-2xl border border-snow/[0.08] bg-panel", className)}>
      <header className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <Icon className="h-4 w-4 text-snow/55" />
        <h2 className="flex-1 text-[14.5px] font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-[12.5px] text-snow/55 hover:text-snow">
            {action ?? "Alle"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </header>
      <div className="min-h-0 flex-1 px-4 pb-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint, alert, href }: { label: string; value: number | string; hint?: string; alert?: boolean; href: string }) {
  return (
    <Link href={href} className="group rounded-2xl border border-snow/[0.08] bg-panel px-4 py-3.5 transition-colors hover:border-snow/20">
      <p className="text-[12px] font-medium tracking-wide text-snow/50 uppercase">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[26px] leading-none font-semibold tabular-nums">{value}</span>
        {hint && <span className={clsx("truncate text-[12.5px]", alert ? "text-error" : "text-snow/50")}>{hint}</span>}
      </p>
    </Link>
  );
}

function AgentBadge({ task }: { task: Task }) {
  if (!task.agent_status) return null;
  const status = AGENT_STATUS[task.agent_status];
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: accentFill(status.color, 16), color: status.color }}>
      <Bot className={clsx("h-3 w-3", task.agent_status === "running" && "animate-pulse")} /> {status.label.replace("Agent: ", "").replace("Agent ", "")}
    </span>
  );
}

function TodoRow({ task, href }: { task: Task; href: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function toAgent() {
    setBusy(true);
    try {
      await api(`/api/aufgaben/agent/${task.id}`, { method: "POST" });
      revalidate("/api/sales/tasks");
      toast("Der Agent legt los");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Übergabe fehlgeschlagen", "error");
    }
    setBusy(false);
  }
  return (
    <li className="group flex items-center gap-2.5 border-b border-snow/[0.06] py-2 last:border-0">
      <span className={clsx("h-2 w-2 shrink-0 rounded-full", isOverdue(task) ? "bg-error" : "bg-snow/20")} />
      <Link href={href} className="min-w-0 flex-1">
        <p className="truncate text-[13.5px]">{task.title}</p>
        {task.due_on && <p className={clsx("text-[11.5px]", isOverdue(task) ? "text-error" : "text-snow/50")}>fällig {new Date(task.due_on).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}</p>}
      </Link>
      <AgentBadge task={task} />
      {!task.agent_status && (
        <IconButton label="An den Agenten übergeben" className="h-8 w-8 text-snow/45 opacity-100 hover:text-snow md:opacity-0 md:group-hover:opacity-100" onClick={toAgent} disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </IconButton>
      )}
    </li>
  );
}

function Week({ workspace, posts, onOpen }: { workspace: WorkspaceSummary; posts: SocialPost[]; onOpen: (post: SocialPost | null, date?: Date) => void }) {
  const start = new Date(new Date().setHours(0, 0, 0, 0));
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY));
  const accounts = new Map(workspace.accounts.map((a) => [a.id, a]));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((day, index) => {
        const mine = posts
          .filter((p) => p.scheduled_at && new Date(p.scheduled_at).toDateString() === day.toDateString())
          .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!));
        return (
          <div key={day.toISOString()} className={clsx("flex min-h-28 flex-col rounded-xl border p-2", index === 0 ? "border-snow/25" : "border-snow/[0.07]")}>
            <p className="flex items-baseline justify-between px-0.5 text-[11.5px]">
              <span className="font-semibold uppercase">{index === 0 ? "Heute" : weekday.format(day)}</span>
              <span className="text-snow/45">{dayNum.format(day)}</span>
            </p>
            <div className="mt-1.5 flex flex-1 flex-col gap-1">
              {mine.map((post) => {
                const provider = accounts.get(post.account_ids[0] ?? "")?.provider;
                const status = POST_STATUS[post.status];
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onOpen(post)}
                    className="flex items-start gap-1.5 rounded-lg border-l-2 bg-snow/[0.05] px-1.5 py-1 text-left hover:bg-snow/[0.1]"
                    style={{ borderColor: status.color ?? "color-mix(in srgb, var(--color-snow) 30%, transparent)" }}
                    title={`${status.label} · ${post.caption.slice(0, 120)}`}
                  >
                    {provider && <ProviderMark provider={provider} className="h-4 min-w-4 px-0.5 text-[8.5px]" />}
                    <span className="min-w-0">
                      <span className="block text-[10.5px] text-snow/50">{clock.format(new Date(post.scheduled_at!))}</span>
                      <span className="line-clamp-2 text-[11.5px] leading-snug">{post.caption || "Ohne Text"}</span>
                    </span>
                  </button>
                );
              })}
              <button type="button" onClick={() => onOpen(null, new Date(day.getTime() + 18 * 3_600_000))} className="mt-auto grid h-6 place-items-center rounded-md text-snow/30 hover:bg-snow/[0.06] hover:text-snow/70" aria-label={`Post am ${dayNum.format(day)} anlegen`}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Cockpit() {
  const { workspace } = useCurrentWorkspace();
  const canTasks = useCan("aufgaben");
  const posts = useResource<SocialPost[]>(workspace ? postsUrl(workspace.id) : null);
  const ideas = useResource<PostIdea[]>(workspace ? ideasUrl(workspace.id) : null);
  const tasks = useResource<Task[]>(canTasks && workspace?.project_id ? "/api/sales/tasks" : null);
  const recordings = useResource<Recording[]>(canTasks ? "/api/sales/meeting_recordings" : null);
  const proposals = useResource<Proposal[]>(canTasks ? "/api/sales/meeting_tasks" : null);
  const autopilot = useResource<Autopilot>(workspace ? `/api/marketing/workspaces/${workspace.id}/autopilot` : null);
  const [editing, setEditing] = useState<{ post: SocialPost | null; date?: Date } | null>(null);
  // Zeitpunkt beim Öffnen: Kennzahlen bleiben beim Neuzeichnen stabil
  const [now] = useState(() => Date.now());

  const open = useMemo(
    () =>
      (tasks.data ?? [])
        .filter((t) => t.project_id === workspace?.project_id && !t.done)
        .sort((a, b) => {
          const rank = (t: Task) => (t.agent_status === "review" || t.agent_status === "failed" ? 0 : isOverdue(t) ? 1 : t.due_on ? 2 : 3);
          return rank(a) - rank(b) || (a.due_on ?? "9").localeCompare(b.due_on ?? "9");
        }),
    [tasks.data, workspace?.project_id]
  );
  if (!workspace) return null;

  const all = posts.data ?? [];
  const week = all.filter((p) => p.scheduled_at && new Date(p.scheduled_at).getTime() >= new Date().setHours(0, 0, 0, 0) && new Date(p.scheduled_at).getTime() < now + 7 * DAY);
  const drafts = all.filter((p) => p.status === "draft").length;
  const published = all.filter((p) => (p.status === "published" || p.status === "partial") && p.published_at && new Date(p.published_at).getTime() > now - 30 * DAY).length;
  const fresh = (ideas.data ?? []).filter((i) => i.status === "new");
  const channels = workspace.accounts.filter((a) => a.provider !== "canva");
  const atAgent = open.filter((t) => t.agent_status && t.agent_status !== "done").length;
  const overdue = open.filter(isOverdue).length;

  // Letzter ausgewerteter Call mit Vorschlägen für diesen Kunden
  const mine = (proposals.data ?? []).filter((p) => p.project_id && p.project_id === workspace.project_id);
  const lastCall = (recordings.data ?? []).find((r) => mine.some((p) => p.recording_id === r.id));
  const openFromCall = lastCall ? mine.filter((p) => p.recording_id === lastCall.id && p.status === "vorschlag").length : 0;
  const greetingDate = new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Cockpit" meta={greetingDate}>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ post: null })}>
          Neuer Post
        </Button>
      </AkteHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1400px] gap-4 p-4 pb-12 md:p-7">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {canTasks && workspace.project_id && <Stat label="Offene To-dos" value={open.length} hint={overdue ? `${overdue} überfällig` : undefined} alert={overdue > 0} href={akteUrl(workspace.id, "aufgaben")} />}
            {canTasks && workspace.project_id && <Stat label="Beim Agenten" value={atAgent} hint={open.some((t) => t.agent_status === "review") ? "zur Prüfung" : undefined} href={akteUrl(workspace.id, "aufgaben")} />}
            <Stat label="Diese Woche" value={week.length} hint="Posts geplant" href={akteUrl(workspace.id, "planung")} />
            <Stat label="Zur Freigabe" value={drafts} hint="Entwürfe" href={akteUrl(workspace.id, "planung")} />
            <Stat label="Veröffentlicht" value={published} hint="30 Tage" href={akteUrl(workspace.id, "planung")} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid min-w-0 content-start gap-4 lg:col-span-2">
              <IdeaComposer workspace={workspace} compact />
              {fresh.length > 0 && (
                <Card title={`Neue Vorschläge (${fresh.length})`} icon={Sparkles} href={akteUrl(workspace.id, "vorschlaege")}>
                  <div className="grid gap-3">
                    {fresh.slice(0, 3).map((idea) => (
                      <IdeaCard key={idea.id} idea={idea} workspace={workspace} dense onEdit={(post) => setEditing({ post })} />
                    ))}
                  </div>
                </Card>
              )}
              <Card title="Die nächsten 7 Tage" icon={CalendarDays} href={akteUrl(workspace.id, "planung")} action="Planung">
                {posts.loading ? <Spinner /> : <Week workspace={workspace} posts={all} onOpen={(post, date) => setEditing({ post, date })} />}
              </Card>
            </div>

            <div className="grid min-w-0 content-start gap-4">
              {canTasks && workspace.project_id && (
                <Card title="To-dos" icon={ListChecks} href={akteUrl(workspace.id, "aufgaben")}>
                  {tasks.loading ? (
                    <Spinner />
                  ) : open.length ? (
                    <ul>
                      {open.slice(0, 7).map((task) => (
                        <TodoRow key={task.id} task={task} href={`${akteUrl(workspace.id, "aufgaben")}?task=${task.id}`} />
                      ))}
                    </ul>
                  ) : (
                    <p className="py-3 text-[13px] text-snow/55">Alles erledigt.</p>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-snow/45">
                    <Bot className="h-3.5 w-3.5" /> Übergib To-dos an den Agenten: Er recherchiert, schreibt Posts und rendert Videos.
                  </p>
                </Card>
              )}

              {canTasks && (
                <Card title="Letzter Call" icon={Video} href={akteUrl(workspace.id, "calls")}>
                  {lastCall ? (
                    <>
                      <p className="text-[11.5px] text-snow/50">{new Date(lastCall.created_at).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</p>
                      <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed text-snow/80">{lastCall.summary ?? "Wird noch ausgewertet …"}</p>
                      {openFromCall > 0 && (
                        <Link href={akteUrl(workspace.id, "calls")} className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium" style={{ background: "color-mix(in srgb, var(--akte) 14%, transparent)", color: "var(--akte-text)" }}>
                          <CircleAlert className="h-4 w-4" /> {openFromCall} To-dos aus dem Call warten auf Übernahme
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-snow/55">Noch kein ausgewerteter Call. Calls über meet.grid-agency.de werden transkribiert, To-dos landen hier.</p>
                  )}
                </Card>
              )}

              <Card title="Autopilot" icon={Rocket} href={akteUrl(workspace.id, "einstellungen/autopilot")} action="Einstellen">
                {autopilot.data ? (
                  <div className="grid gap-1.5 text-[13px]">
                    <p className="flex items-center gap-2">
                      <span className={clsx("h-2 w-2 rounded-full", autopilot.data.enabled ? "bg-[#30a46c]" : "bg-snow/25")} />
                      {autopilot.data.enabled ? (autopilot.data.mode === "auto" ? "An: postet vollautomatisch" : "An: erstellt Posts zur Freigabe") : "Aus"}
                    </p>
                    {autopilot.data.enabled && (
                      <p className="text-snow/60">
                        {autopilot.data.per_week}× pro Woche auf {autopilot.data.providers.map((p) => p[0].toUpperCase() + p.slice(1)).join(", ")}
                        {autopilot.data.agent_calls ? " · To-dos aus Calls gehen direkt an den Agenten" : ""}
                      </p>
                    )}
                    {autopilot.data.last_result && <p className="text-[12px] text-snow/50">Zuletzt: {autopilot.data.last_result}</p>}
                  </div>
                ) : (
                  <Spinner />
                )}
              </Card>

              <Card title="Kanäle" icon={Link2} href={akteUrl(workspace.id, "einstellungen")} action="Verwalten">
                {channels.length ? (
                  <ul className="grid gap-2">
                    {channels.map((a) => (
                      <li key={a.id} className="flex items-center gap-2.5 text-[13px]">
                        <ProviderMark provider={a.provider} />
                        <span className="min-w-0 flex-1 truncate">{a.name}</span>
                        <span className={clsx("h-2 w-2 rounded-full", a.status === "active" ? "bg-[#30a46c]" : "bg-error")} title={a.status === "active" ? "Verbunden" : a.error ?? "Fehler"} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-snow/55">Noch kein Kanal verbunden. Posts bleiben Entwürfe, bis LinkedIn, Instagram, Facebook oder TikTok verbunden sind.</p>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
      {editing && <PostEditor post={editing.post} initialDate={editing.date} workspace={workspace} accounts={channels} onClose={() => setEditing(null)} />}
    </div>
  );
}
