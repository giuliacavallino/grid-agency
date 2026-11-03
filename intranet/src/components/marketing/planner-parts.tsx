"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Check, Search, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { PROVIDERS, type Autopilot, type PostIdea, type PostProvider, type Provider, type SocialAccount, type SocialPost } from "@/lib/marketing";
import { accentFill, accentText } from "@/lib/theme";
import { Button, useToast } from "@/components/ui";
import { akteUrl } from "@/components/akte/shell";
import { ideasUrl } from "@/components/akte/ideas";

// Bausteine der Planung: Kanal-Filter, Agentenleiste, Post-Karten.

export const DAY = 86_400_000;
export const EDITABLE: SocialPost["status"][] = ["draft", "scheduled", "failed"];

/** Markierung für „heute“ (Rahmen der Tagesspalte) */
export const TODAY_ACCENT = accentText("#0f9f8f");

// ---------- Datum ----------

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const pad = (n: number) => String(n).padStart(2, "0");
/** „Mo“ */
export const weekday = (d: Date) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
/** „02.11.“ */
export const shortDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;

/** Kalenderwoche nach ISO 8601 */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7);
}

/** Wann ein Post im Kalender steht: veröffentlicht → dann, sonst geplanter Termin */
export const postDate = (p: SocialPost) => (p.status === "published" || p.status === "partial" ? p.published_at ?? p.scheduled_at : p.scheduled_at);

/** Neuer Termin am Tag `day` mit der Uhrzeit des alten Termins (sonst 18 Uhr) */
export function moveTo(day: Date, previous: string | null) {
  const target = new Date(day);
  const old = previous ? new Date(previous) : null;
  target.setHours(old ? old.getHours() : 18, old ? old.getMinutes() : 0, 0, 0);
  return target;
}

/** Entwurf mit Termin: wartet auf Freigabe (z. B. vom Autopilot im Prüfmodus) */
export const awaitsApproval = (p: SocialPost) => p.status === "draft" && !!p.scheduled_at;

// ---------- Kanäle ----------

export type Channel = Exclude<Provider, "canva"> | "none";

export const CHANNELS: Record<Channel, { label: string; color: string }> = {
  linkedin: { label: PROVIDERS.linkedin.label, color: "#0a66c2" },
  instagram: { label: PROVIDERS.instagram.label, color: "#9b51e0" },
  facebook: { label: PROVIDERS.facebook.label, color: "#4c8dff" },
  tiktok: { label: PROVIDERS.tiktok.label, color: "#f2711c" },
  none: { label: "Ohne Kanal", color: "#8c867c" },
};
export const CHANNEL_ORDER: Channel[] = ["linkedin", "instagram", "facebook", "tiktok", "none"];

/** Kanäle eines Posts (über die verbundenen Konten) */
export function postChannels(post: SocialPost, accounts: Map<string, SocialAccount>): Channel[] {
  const list = new Set<Channel>();
  for (const id of post.account_ids) {
    const provider = accounts.get(id)?.provider;
    if (provider && provider !== "canva") list.add(provider);
  }
  return list.size ? CHANNEL_ORDER.filter((c) => list.has(c)) : ["none"];
}

export function ChannelDot({ channel, className }: { channel: Channel; className?: string }) {
  return <span aria-hidden className={clsx("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: CHANNELS[channel].color }} />;
}

/** Filter-Chip: Punkt, Kanal, Anzahl */
export function ChannelChip({ channel, count, active, onToggle }: { channel: Channel; count: number; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      title={active ? `${CHANNELS[channel].label} ausblenden` : `${CHANNELS[channel].label} einblenden`}
      className={clsx(
        "flex h-9 items-center gap-2 rounded-full bg-surface pr-3.5 pl-3 text-[13px] font-medium shadow-[0_1px_2px_var(--shadow-color),0_2px_8px_var(--shadow-color)] transition-[opacity,box-shadow] hover:shadow-[0_2px_4px_var(--shadow-color),0_4px_14px_var(--shadow-color)]",
        !active && "opacity-50"
      )}
    >
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full border-2"
        style={{ borderColor: CHANNELS[channel].color, background: active ? CHANNELS[channel].color : "transparent" }}
      />
      <span className={clsx(!active && "line-through decoration-snow/40")}>{CHANNELS[channel].label}</span>
      <span className="text-snow/45 tabular-nums">{count}</span>
    </button>
  );
}

// ---------- Status ----------

type Chip = { label: string; color?: string; muted?: boolean };

/** Vorschlag = Entwurf aus der Trend-Recherche oder vom Agenten */
export function suggestionBy(post: SocialPost, fromIdeas: Set<string>) {
  if (post.status !== "draft") return null;
  if (post.created_by === "autopilot" || post.created_by === "agent") return "Vorschlag · Agent";
  if (fromIdeas.has(post.id)) return "Vorschlag";
  return null;
}

function statusChip(post: SocialPost, suggestion: string | null): Chip {
  const failed = post.status === "failed" || Object.values(post.results).some((r) => r.status === "failed");
  if (failed) return { label: "Fehler", color: "#e5484d" };
  if (suggestion) return { label: suggestion, muted: true };
  switch (post.status) {
    case "published":
      return { label: "Veröffentlicht", color: "#5b8a6f" };
    case "partial":
      return { label: "Teilweise veröffentlicht", color: "#d9822b" };
    case "publishing":
      return { label: "Wird gepostet", color: "#d9a21b" };
    case "scheduled":
      return { label: "Geplant", color: "#e0a100" };
    default:
      return { label: "Entwurf" };
  }
}

function StatusChip({ chip }: { chip: Chip }) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-[11px] leading-4 font-medium",
        !chip.color && (chip.muted ? "bg-snow/[0.05] text-snow/50" : "bg-snow/[0.08] text-snow/65")
      )}
      style={chip.color ? { background: accentFill(chip.color, 16), color: accentText(chip.color) } : undefined}
    >
      {chip.label}
    </span>
  );
}

// ---------- Post-Karte ----------

/** Erste Zeile des Texts als Titel/Hook */
const hook = (caption: string) => caption.trim().split("\n").find((line) => line.trim()) ?? "";

export function PostCard({
  post,
  accounts,
  fromIdeas,
  onOpen,
  compact = false,
  className,
}: {
  post: SocialPost;
  accounts: Map<string, SocialAccount>;
  fromIdeas: Set<string>;
  onOpen: () => void;
  compact?: boolean;
  className?: string;
}) {
  const at = postDate(post);
  const channels = postChannels(post, accounts);
  const main = channels[0];
  const draggable = EDITABLE.includes(post.status);
  const suggestion = suggestionBy(post, fromIdeas);
  const chip = statusChip(post, suggestion);
  const title = hook(post.caption) || "Ohne Text";
  const image = post.media.find((m) => m.kind === "image" && m.url);
  const video = post.media.some((m) => m.kind === "video");

  const drag = {
    draggable,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("text/post", post.id);
      e.dataTransfer.effectAllowed = "move";
    },
  };

  if (compact) {
    return (
      <button
        type="button"
        {...drag}
        onClick={onOpen}
        title={`${at ? time(at) : "–"} · ${channels.map((c) => CHANNELS[c].label).join(", ")} · ${chip.label}\n${title}`}
        className={clsx(
          "flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-panel px-1.5 py-1 text-left text-[11.5px] shadow-[0_1px_3px_var(--shadow-color)] transition-shadow hover:shadow-[0_2px_8px_var(--shadow-color)]",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
        style={{ borderLeft: `3px solid ${CHANNELS[main].color}` }}
      >
        {at && <span className="shrink-0 font-semibold tabular-nums">{time(at)}</span>}
        <span className={clsx("truncate text-snow/75", suggestion && "italic")}>{title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      {...drag}
      onClick={onOpen}
      className={clsx(
        "flex w-full shrink-0 flex-col gap-1.5 overflow-hidden rounded-2xl border border-snow/[0.06] bg-panel p-3 text-left shadow-[0_1px_2px_var(--shadow-color),0_4px_14px_var(--shadow-color)] transition-shadow hover:shadow-[0_2px_4px_var(--shadow-color),0_8px_22px_var(--shadow-color)]",
        draggable && "cursor-grab active:cursor-grabbing",
        className
      )}
      style={{ borderLeft: `3px solid ${CHANNELS[main].color}` }}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <span className="font-semibold tabular-nums">{at ? time(at) : "–"}</span>
        <ChannelDot channel={main} className="mx-0.5" />
        <span className="truncate text-snow/55">
          {CHANNELS[main].label}
          {channels.length > 1 && ` +${channels.length - 1}`}
          {video && " · Video"}
        </span>
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage
        <img src={image.url} alt="" className="h-20 w-full rounded-xl object-cover" draggable={false} />
      )}
      <span className={clsx("line-clamp-3 text-[13px] leading-snug font-semibold break-words", suggestion ? "font-medium text-snow/70 italic" : "text-snow/90")}>{title}</span>
      <span className="flex pt-0.5">
        <StatusChip chip={chip} />
      </span>
    </button>
  );
}

// ---------- Agentenleiste ----------

const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${weekday(d)} ${shortDate(d)}${String(d.getFullYear()).slice(2)} · ${time(iso)}`;
};

const POST_PROVIDERS: PostProvider[] = ["linkedin", "instagram", "facebook", "tiktok"];

export function AgentBar({
  workspaceId,
  accounts,
  ideas,
  autopilot,
  approvals,
  approving,
  onApprovals,
}: {
  workspaceId: string;
  accounts: SocialAccount[];
  ideas: PostIdea[] | undefined;
  autopilot: Autopilot | undefined;
  approvals: number;
  approving: boolean;
  onApprovals: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const connected = POST_PROVIDERS.filter((p) => accounts.some((a) => a.provider === p));
  const providers = autopilot?.providers.length ? autopilot.providers : connected.length ? connected : (["linkedin"] as PostProvider[]);
  const name = providers.length === 1 ? `${PROVIDERS[providers[0]].label}-Agent` : "Content-Agent";
  const fresh = ideas?.filter((i) => i.status === "new").length ?? 0;
  const last = [autopilot?.last_run ?? null, ideas?.[0]?.created_at ?? null].filter((x): x is string => !!x).sort().at(-1);

  async function research() {
    setBusy(true);
    try {
      const found = await api<PostIdea[]>("/api/marketing/ideas", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, providers, per_provider: 3, focus: autopilot?.focus ?? "" }) });
      mutate<PostIdea[]>(ideasUrl(workspaceId), (list) => [...found, ...list]);
      revalidate(ideasUrl(workspaceId));
      toast(`${found.length} Vorschläge recherchiert`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Recherche fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-snow/[0.06] bg-surface px-4 py-3 shadow-[0_1px_2px_var(--shadow-color),0_4px_14px_var(--shadow-color)]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: "color-mix(in srgb, var(--akte) 16%, transparent)", color: "var(--akte-text)" }}>
          <Bot className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{name}</p>
          <p className="truncate text-[12.5px] text-snow/50">
            {busy ? "Recherchiert Trends, News und Anlässe … (1–3 Minuten)" : last ? `Zuletzt ${stamp(last)}` : "Noch keine Recherche"}
            {autopilot?.enabled && !busy && ` · Autopilot ${autopilot.mode === "auto" ? "postet automatisch" : "plant zur Freigabe"}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="h-9 px-4" icon={<Search className="h-4 w-4" />} loading={busy} loadingText="Sucht Themen …" onClick={research}>
          Themen suchen
        </Button>
        <Link
          href={akteUrl(workspaceId, "vorschlaege")}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 text-[13px] font-medium hover:bg-snow/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow"
        >
          <Sparkles className="h-4 w-4" />
          Vorschläge <span className="text-snow/55 tabular-nums">({fresh})</span>
        </Link>
        {(approvals > 0 || approving) && (
          <button
            type="button"
            aria-pressed={approving}
            onClick={onApprovals}
            title={approving ? "Wieder alle Posts zeigen" : "Nur Entwürfe zeigen, die auf Freigabe warten"}
            className={clsx(
              "inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow",
              approving ? "bg-snow/80 text-sky ring-2 ring-snow/25 ring-offset-2 ring-offset-surface" : "bg-snow text-sky hover:bg-snow/85"
            )}
          >
            {approving ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            Freigeben <span className="tabular-nums opacity-70">({approvals})</span>
          </button>
        )}
      </div>
    </section>
  );
}
