"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, ExternalLink, FilePenLine, RotateCcw, Sparkles, TrendingUp, X } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { inkOn, PROVIDERS, type IdeaVisual, type PostIdea, type PostProvider, type SocialPost } from "@/lib/marketing";
import { Button, Empty, Input, Spinner, useToast } from "@/components/ui";
import { ProviderMark } from "@/components/marketing/common";
import { PostEditor, postsUrl } from "@/components/marketing/post-editor";
import { URL_WORKSPACES, useCurrentWorkspace, type WorkspaceSummary } from "@/components/marketing/workspace";
import { akteUrl, AkteHeader } from "./shell";

// Vorschläge: Trend-Recherche → fertige Posts in der CI → ein Klick plant sie
// ein (oder legt einen Entwurf an). Live-Recherche dauert 1–3 Minuten.

export const ideasUrl = (workspaceId: string) => `/api/marketing/ideas?workspace=${workspaceId}`;

const PLATFORMS: PostProvider[] = ["linkedin", "instagram", "facebook", "tiktok"];
const RATIO: Record<IdeaVisual["format"], string> = { "1:1": "1 / 1", "4:5": "4 / 5", "9:16": "9 / 16", "1.91:1": "1.91 / 1" };
const STAGES = ["Durchsucht News, Trends und Anlässe …", "Prüft Quellen und Relevanz für die Zielgruppe …", "Schreibt Posts nach der CI …", "Fast fertig …"];

const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Vorschau der CI-Grafik (entspricht der gerechneten Grafik); width in px */
export function GraphicPreview({ workspace, visual, width = 144, className }: { workspace: WorkspaceSummary; visual: IdeaVisual; width?: number; className?: string }) {
  const ink = inkOn(workspace.color);
  const accent = workspace.secondary_color && workspace.secondary_color !== workspace.color ? workspace.secondary_color : ink;
  const u = width / 100; // 1 % der Breite
  return (
    <div
      className={clsx("relative flex shrink-0 flex-col justify-between overflow-hidden rounded-xl shadow-sm", className)}
      style={{ width, aspectRatio: RATIO[visual.format], background: workspace.color, color: ink, padding: 7 * u }}
      aria-label={`Grafik: ${visual.headline}`}
    >
      <span className="truncate uppercase opacity-75" style={{ fontSize: 5 * u, letterSpacing: 0.8 * u }}>
        {workspace.name}
      </span>
      <div>
        <span className="block rounded-full" style={{ height: 1.2 * u, width: 14 * u, marginBottom: 5 * u, background: accent }} />
        <p className="leading-[1.08] font-bold tracking-tight" style={{ fontSize: 10.5 * u }}>
          {visual.headline}
        </p>
        {visual.subline && (
          <p className="leading-snug opacity-80" style={{ fontSize: 4.6 * u, marginTop: 3 * u }}>
            {visual.subline}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        {workspace.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Logo aus dem Storage
          <img src={workspace.logo_url} alt="" className="bg-white object-contain" style={{ height: 9 * u, borderRadius: 1.5 * u, padding: 1.2 * u }} />
        ) : (
          <span className="font-bold" style={{ fontSize: 4.5 * u }}>
            {workspace.name}
          </span>
        )}
        <span className="rounded-full" style={{ height: 6 * u, width: 6 * u, background: accent }} />
      </div>
    </div>
  );
}

/** Recherche starten: Plattformen, Anzahl, optional Fokus */
export function IdeaComposer({ workspace, compact = false }: { workspace: WorkspaceSummary; compact?: boolean }) {
  const toast = useToast();
  const connected = new Set(workspace.accounts.map((a) => a.provider));
  const [providers, setProviders] = useState<PostProvider[]>(() => {
    const own = PLATFORMS.filter((p) => connected.has(p));
    return own.length ? own.slice(0, 2) : ["linkedin"];
  });
  const [count, setCount] = useState(3);
  const [focus, setFocus] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 25_000);
    return () => clearInterval(timer);
  }, [busy]);

  const toggle = (p: PostProvider) => setProviders((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]));

  async function run() {
    setBusy(true);
    setStage(0);
    try {
      const ideas = await api<PostIdea[]>("/api/marketing/ideas", { method: "POST", body: JSON.stringify({ workspace_id: workspace.id, providers, per_provider: count, focus }) });
      mutate<PostIdea[]>(ideasUrl(workspace.id), (list) => [...ideas, ...list]);
      revalidate(ideasUrl(workspace.id));
      toast(`${ideas.length} Vorschläge recherchiert`);
      setFocus("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Recherche fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <section className={clsx("rounded-2xl border border-snow/[0.08] bg-panel", compact ? "p-4" : "p-5")}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--akte) 16%, transparent)", color: "var(--akte-text)" }}>
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold">Posts vorschlagen</h2>
          <p className="text-[13px] text-snow/60">Recherchiert Trends, News und Anlässe im Web und schreibt daraus Posts nach der CI, mit Grafik.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={providers.includes(p)}
            onClick={() => toggle(p)}
            disabled={busy}
            className={clsx(
              "flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-[13px] transition-colors",
              providers.includes(p) ? "border-snow/40 bg-snow/[0.08] text-snow" : "border-snow/12 text-snow/55 hover:text-snow"
            )}
          >
            <ProviderMark provider={p} />
            {PROVIDERS[p].label}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-snow/10 sm:block" />
        <div className="flex items-center rounded-full border border-snow/12 p-0.5" role="group" aria-label="Vorschläge je Plattform">
          {[1, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={count === n}
              onClick={() => setCount(n)}
              disabled={busy}
              className={clsx("h-8 rounded-full px-3 text-[13px]", count === n ? "bg-snow text-sky" : "text-snow/60 hover:text-snow")}
            >
              {n}×
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={focus} onChange={(e) => setFocus(e.target.value)} disabled={busy} placeholder="Fokus (optional), z. B. Herbstkarte, Recruiting, Messe in Köln" aria-label="Fokus der Recherche" className="h-10 w-full sm:flex-1" />
        <Button variant="primary" className="h-10" icon={<Sparkles className="h-4 w-4" />} loading={busy} loadingText="Recherchiert …" disabled={!providers.length} onClick={run}>
          Vorschläge erstellen
        </Button>
      </div>
      {busy && (
        <p className="mt-3 flex items-center gap-2 text-[12.5px] text-snow/60" aria-live="polite">
          <Spinner className="h-3.5 w-3.5" /> {STAGES[stage]} Das dauert 1–3 Minuten.
        </p>
      )}
    </section>
  );
}

/** Ein Vorschlag mit Grafik, Text, Trend und Quellen */
export function IdeaCard({ idea, workspace, onEdit, dense = false }: { idea: PostIdea; workspace: WorkspaceSummary; onEdit: (post: SocialPost) => void; dense?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"next" | "draft" | "dismiss" | "restore" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const url = ideasUrl(workspace.id);
  const channels = workspace.accounts.filter((a) => a.provider === idea.provider && a.status === "active").length;

  async function create(schedule: "next" | "none") {
    setBusy(schedule === "next" ? "next" : "draft");
    try {
      const post = await api<SocialPost>(`/api/marketing/ideas/${idea.id}/post`, { method: "POST", body: JSON.stringify({ schedule }) });
      mutate<PostIdea[]>(url, (list) => list.map((i) => (i.id === idea.id ? { ...i, status: "used", post_id: post.id } : i)));
      revalidate(postsUrl(workspace.id));
      revalidate(URL_WORKSPACES);
      if (schedule === "none") onEdit(post);
      else toast(post.status === "scheduled" ? `Eingeplant: ${new Date(post.scheduled_at!).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Als Entwurf mit Termin angelegt (noch kein Kanal verbunden)");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function setStatus(status: "dismissed" | "new") {
    setBusy(status === "dismissed" ? "dismiss" : "restore");
    try {
      const saved = await api<PostIdea>(`/api/marketing/ideas/${idea.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      mutate<PostIdea[]>(url, (list) => list.map((i) => (i.id === idea.id ? saved : i)));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <article className={clsx("flex gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-4 transition-opacity", idea.status === "dismissed" && "opacity-55")}>
      <GraphicPreview workspace={workspace} visual={idea.visual} width={dense ? 96 : 132} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <ProviderMark provider={idea.provider} />
          <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{idea.title}</h3>
          {idea.status === "used" && <span className="rounded-full bg-[#30a46c]/15 px-2 py-0.5 text-[11.5px] font-medium text-[#30a46c]">Im Kalender</span>}
        </div>
        {idea.trend && (
          <p className="mt-1 flex gap-1.5 text-[12.5px] text-snow/60">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--akte-text)" }} />
            <span className={dense ? "line-clamp-1" : "line-clamp-2"}>{idea.trend}</span>
          </p>
        )}
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-left">
          <p className={clsx("text-[13.5px] leading-relaxed whitespace-pre-line text-snow/85", !expanded && (dense ? "line-clamp-2" : "line-clamp-4"))}>{idea.caption}</p>
          {expanded && idea.hashtags.length > 0 && <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--akte-text)" }}>{idea.hashtags.join(" ")}</p>}
        </button>
        {!dense && idea.sources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {idea.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title} className="flex h-6 items-center gap-1 rounded-full bg-snow/[0.06] px-2 text-[11.5px] text-snow/60 hover:text-snow">
                <ExternalLink className="h-3 w-3" /> {domain(s.url)}
              </a>
            ))}
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {idea.status === "new" && (
            <>
              <Button
                size="sm"
                variant="primary"
                icon={<CalendarCheck2 className="h-4 w-4" />}
                loading={busy === "next"}
                loadingText="Wird erstellt …"
                disabled={busy !== null}
                onClick={() => create("next")}
                title={channels ? "Mit Grafik zum nächsten freien Termin einplanen" : "Noch kein Kanal verbunden: wird Entwurf mit Termin"}
              >
                Einplanen
              </Button>
              <Button size="sm" icon={<FilePenLine className="h-4 w-4" />} loading={busy === "draft"} loadingText="Wird erstellt …" disabled={busy !== null} onClick={() => create("none")}>
                Bearbeiten
              </Button>
              <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} loading={busy === "dismiss"} loadingText="…" disabled={busy !== null} onClick={() => setStatus("dismissed")}>
                Verwerfen
              </Button>
            </>
          )}
          {idea.status === "dismissed" && (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} loading={busy === "restore"} loadingText="…" onClick={() => setStatus("new")}>
              Wiederherstellen
            </Button>
          )}
          {idea.status === "used" && (
            <Link href={akteUrl(workspace.id, "planung")} className="text-[13px] text-snow/60 underline-offset-2 hover:text-snow hover:underline">
              In der Planung öffnen
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

type Filter = "new" | "used" | "dismissed";

/** Seite „Vorschläge“ der Kundenakte */
export function Ideas() {
  const { workspace } = useCurrentWorkspace();
  const ideas = useResource<PostIdea[]>(workspace ? ideasUrl(workspace.id) : null);
  const [filter, setFilter] = useState<Filter>("new");
  const [editing, setEditing] = useState<SocialPost | null>(null);
  if (!workspace) return null;
  const list = (ideas.data ?? []).filter((i) => i.status === filter);
  const count = (f: Filter) => (ideas.data ?? []).filter((i) => i.status === f).length;

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Vorschläge" meta="Trend-Recherche und fertige Posts in der CI">
        <div className="flex rounded-full border border-snow/12 p-0.5" role="tablist">
          {(
            [
              ["new", "Neu"],
              ["used", "Umgesetzt"],
              ["dismissed", "Verworfen"],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={clsx("h-8 rounded-full px-3 text-[13px]", filter === f ? "bg-snow text-sky" : "text-snow/60 hover:text-snow")}>
              {label} <span className="tabular-nums opacity-60">{count(f)}</span>
            </button>
          ))}
        </div>
      </AkteHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-6xl gap-4 p-4 pb-12 md:p-7">
          <IdeaComposer workspace={workspace} />
          {ideas.loading ? (
            <div className="grid place-items-center py-16">
              <Spinner />
            </div>
          ) : !list.length ? (
            <Empty
              icon={<Sparkles className="h-8 w-8" />}
              title={filter === "new" ? "Keine offenen Vorschläge" : filter === "used" ? "Noch nichts umgesetzt" : "Nichts verworfen"}
              text={filter === "new" ? "Starte oben eine Recherche, oder schalte in den Einstellungen den Autopilot ein: Er recherchiert jede Woche selbst und plant die Posts ein." : undefined}
            />
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {list.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} workspace={workspace} onEdit={setEditing} />
              ))}
            </div>
          )}
        </div>
      </div>
      {editing && <PostEditor post={editing} workspace={workspace} accounts={workspace.accounts.filter((a) => a.provider !== "canva")} onClose={() => setEditing(null)} />}
    </div>
  );
}
