"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  GripVertical,
  Layers,
  Lock,
  PenLine,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import type {
  MediaItem,
  ProfilePost,
  ProfileResponse,
  SocialPost,
} from "@/lib/marketing";
import { daysRangeUrl, isoDay, type MarketingDay } from "@/lib/marketing-days";
import { Button, useToast } from "@/components/ui";
import { postsUrl } from "./post-editor";
import {
  URL_WORKSPACES,
  WorkspaceLogo,
  type WorkspaceSummary,
} from "./workspace";

// Feed-Vorschau wie bei Instagram: oben die geplanten Posts (neuester Termin
// links oben), darunter, was schon online ist. Geplante Posts lassen sich
// per Drag & Drop umsortieren und Entwürfe ohne Termin probeweise in den Feed
// ziehen – erst „Reihenfolge übernehmen“ tauscht die Termine. Ein Klick
// öffnet die Vorschau, Karussells lassen sich dort durchwischen.

type Tile =
  | { key: string; kind: "plan"; post: SocialPost; added: boolean }
  | {
      key: string;
      kind: "online";
      image: string | null;
      caption: string;
      type: ProfilePost["type"];
      url: string | null;
      date: string | null;
      media?: MediaItem[];
      post?: SocialPost;
    };

const EDITABLE = ["draft", "scheduled", "failed"];
const DAY = 86_400_000;

const isFeed = (p: SocialPost) => p.format !== "story";
const firstImage = (media: MediaItem[]) =>
  media.find((m) => m.kind === "image" && m.url)?.url ?? null;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

export function FeedGrid({
  workspace,
  posts,
  onOpen,
}: {
  workspace: WorkspaceSummary;
  posts: SocialPost[];
  onOpen: (post: SocialPost) => void;
}) {
  const toast = useToast();
  const igAccount = workspace.accounts.find(
    (a) => a.provider === "instagram" && a.status === "active",
  );
  const live = useResource<ProfileResponse>(
    igAccount
      ? `${URL_WORKSPACES}/${workspace.id}/profile?provider=instagram`
      : null,
  );
  const [today] = useState(() => new Date());
  // Datum der Anlässe (Tage-Autopilot), um verschobene Anlass-Posts zu markieren
  const days = useResource<MarketingDay[]>(
    daysRangeUrl(
      workspace.id,
      isoDay(new Date(today.getTime() - 2 * DAY)),
      isoDay(new Date(today.getTime() + 120 * DAY)),
    ),
  );
  const dayDates = useMemo(
    () => new Map((days.data ?? []).map((d) => [d.id, d.date])),
    [days.data],
  );
  const igIds = new Set(
    workspace.accounts
      .filter((a) => a.provider === "instagram")
      .map((a) => a.id),
  );
  // Mit verbundenem Instagram nur Posts dorthin, sonst alle Feed-Posts
  const forInstagram = (p: SocialPost) =>
    isFeed(p) &&
    (!igIds.size ||
      !p.account_ids.length ||
      p.account_ids.some((id) => igIds.has(id)));

  const [now] = useState(() => Date.now());
  const planned = useMemo(
    () =>
      posts
        .filter(
          (p) =>
            forInstagram(p) &&
            EDITABLE.includes(p.status) &&
            p.scheduled_at &&
            Date.parse(p.scheduled_at) >= now - DAY,
        )
        .sort((a, b) => b.scheduled_at!.localeCompare(a.scheduled_at!)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- now/forInstagram hängen an posts und Konten
    [posts, workspace.accounts],
  );
  const undated = useMemo(
    () =>
      posts.filter(
        (p) => forInstagram(p) && p.status === "draft" && !p.scheduled_at,
      ),
    [posts],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Spielwiese: Reihenfolge der geplanten Posts plus probeweise hinzugefügte Entwürfe
  const base = useMemo(() => planned.map((p) => p.id), [planned]);
  // Eigene Reihenfolge (null = wie geplant); neue oder gelöschte Posts fließen ein
  const [custom, setCustom] = useState<string[] | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const order = useMemo(
    () =>
      custom
        ? [
            ...custom.filter((id) => base.includes(id) || added.includes(id)),
            ...base.filter((id) => !custom.includes(id)),
          ]
        : base,
    [custom, base, added],
  );
  const setOrder = (update: (list: string[]) => string[]) =>
    setCustom(update(order));

  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const dirty = added.length > 0 || order.join() !== base.join();

  // Termine: die bisherigen Slots (neuester zuerst), für hinzugefügte Entwürfe neue Tage danach
  const slots = useMemo(() => {
    const existing = planned
      .map((p) => p.scheduled_at!)
      .sort((a, b) => b.localeCompare(a));
    const latest = existing[0]
      ? Date.parse(existing[0])
      : (() => {
          const d = new Date(now + DAY);
          d.setHours(18, 0, 0, 0);
          return d.getTime() - DAY;
        })();
    const extra = added.map((_, i) =>
      new Date(latest + (added.length - i) * DAY).toISOString(),
    );
    return [...extra, ...existing];
  }, [planned, added, now]);

  const online: Tile[] = useMemo(() => {
    if (igAccount && live.data?.posts?.length) {
      return live.data.posts.map((p) => ({
        key: `ig-${p.id}`,
        kind: "online",
        image: p.image,
        caption: p.caption,
        type: p.type,
        url: p.url,
        date: p.date,
      }));
    }
    return posts
      .filter(
        (p) =>
          forInstagram(p) &&
          ["published", "partial", "publishing"].includes(p.status),
      )
      .sort((a, b) =>
        (b.published_at ?? b.scheduled_at ?? "").localeCompare(
          a.published_at ?? a.scheduled_at ?? "",
        ),
      )
      .map((p) => ({
        key: `hub-${p.id}`,
        kind: "online",
        image: firstImage(p.media),
        caption: p.caption,
        type: p.media.some((m) => m.kind === "video")
          ? "video"
          : p.media.length > 1
            ? "carousel"
            : "image",
        url: null,
        date: p.published_at,
        media: p.media,
        post: p,
      }));
  }, [igAccount, live.data, posts]); // eslint-disable-line react-hooks/exhaustive-deps

  const planTiles: Tile[] = order
    .map((id) => byId.get(id))
    .filter((p): p is SocialPost => !!p)
    .map((post) => ({
      key: post.id,
      kind: "plan",
      post,
      added: added.includes(post.id),
    }));
  const tiles = [...planTiles, ...online];
  const tray = undated.filter((p) => !added.includes(p.id));

  function drop(index: number) {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    const target = Math.min(
      index,
      order.length + (order.includes(id) ? -1 : 0),
    );
    if (!order.includes(id)) setAdded((list) => [...list, id]);
    setOrder((list) => {
      const rest = list.filter((x) => x !== id);
      rest.splice(Math.max(0, Math.min(target, rest.length)), 0, id);
      return rest;
    });
  }

  function reset() {
    setCustom(null);
    setAdded([]);
  }

  async function apply() {
    setSaving(true);
    try {
      const changes = order
        .map((id, i) => ({ post: byId.get(id)!, at: slots[i] }))
        .filter(({ post, at }) => post && at && post.scheduled_at !== at);
      for (const { post, at } of changes) {
        await api<SocialPost>(`/api/marketing/posts/${post.id}`, {
          method: "PATCH",
          body: JSON.stringify({ scheduled_at: at }),
        });
      }
      revalidate(postsUrl(workspace.id));
      revalidate(URL_WORKSPACES);
      setAdded([]);
      toast(
        changes.length
          ? `${changes.length} Termin${changes.length === 1 ? "" : "e"} angepasst`
          : "Keine Änderung",
      );
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Übernehmen fehlgeschlagen",
        "error",
      );
      revalidate(postsUrl(workspace.id));
    }
    setSaving(false);
  }

  const handle =
    workspace.profiles?.instagram?.replace(/\/+$/, "").split("/").pop() ?? null;
  const profile = live.data?.profile;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      {/* Telefon-Ansicht */}
      <section
        aria-label="Instagram-Feed"
        className="overflow-hidden rounded-3xl border border-snow/[0.08] bg-surface shadow-[0_2px_10px_var(--shadow-color)]"
      >
        <header className="flex items-center gap-4 px-5 pt-5 pb-4">
          <WorkspaceLogo workspace={workspace} size={64} box />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">
              {profile?.handle ?? (handle ? `@${handle}` : workspace.name)}
            </p>
            <div className="mt-1 flex gap-4 text-[12.5px] text-snow/60 tabular-nums">
              <span>
                <b className="text-snow">{profile?.posts ?? online.length}</b>{" "}
                Beiträge
              </span>
              {profile?.followers !== undefined && (
                <span>
                  <b className="text-snow">
                    {profile.followers.toLocaleString("de-DE")}
                  </b>{" "}
                  Follower
                </span>
              )}
              <span>
                <b className="text-snow">{planTiles.length}</b> geplant
              </span>
            </div>
          </div>
        </header>
        <div
          className="grid grid-cols-3 gap-[2px] bg-snow/[0.06]"
          onDragLeave={() => setOver(null)}
        >
          {tiles.map((tile, index) => (
            <FeedTile
              key={tile.key}
              tile={tile}
              dragging={dragging === tile.key}
              over={over === index && tile.kind === "plan"}
              onDragStart={() => tile.kind === "plan" && setDragging(tile.key)}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDragOver={() => tile.kind === "plan" && setOver(index)}
              onDrop={() => drop(tile.kind === "plan" ? index : order.length)}
              onOpen={() => setPreview(index)}
              onRemove={
                tile.kind === "plan" && tile.added
                  ? () =>
                      setAdded((list) => list.filter((id) => id !== tile.key))
                  : undefined
              }
              slot={tile.kind === "plan" ? slots[index] : undefined}
              occasions={dayDates}
            />
          ))}
          {!tiles.length && (
            <p className="col-span-3 bg-surface px-6 py-16 text-center text-[13px] text-snow/55">
              Noch keine Posts. Entwürfe rechts in den Feed ziehen.
            </p>
          )}
          {/* Ablage am Ende der geplanten Posts */}
          {dragging && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setOver(order.length);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(order.length);
              }}
              className="col-span-3 grid h-14 place-items-center bg-surface text-[12px] text-snow/50"
            >
              Hier ablegen (ältester geplanter Post)
            </div>
          )}
        </div>
      </section>

      {/* Steuerung und Entwürfe */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-3xl border border-snow/[0.08] bg-surface p-5 shadow-[0_2px_10px_var(--shadow-color)]">
          <p className="text-[14px] font-semibold">Feed ausprobieren</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-snow/60">
            Geplante Posts per Drag &amp; Drop verschieben, Entwürfe aus der
            Liste in den Feed ziehen. Erst „Reihenfolge übernehmen“ ändert die
            Termine: Die vorhandenen Termine bleiben, nur die Posts tauschen die
            Plätze; neue Entwürfe kommen danach.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              disabled={!dirty || saving}
              onClick={reset}
            >
              Zurücksetzen
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={<Save className="h-4 w-4" />}
              disabled={!dirty}
              loading={saving}
              loadingText="Wird übernommen …"
              onClick={apply}
            >
              Reihenfolge übernehmen
            </Button>
          </div>
          {!igAccount && (
            <p className="mt-3 text-[12px] text-snow/45">
              Instagram ist nicht verbunden: Unten im Feed stehen die im Hub
              veröffentlichten Posts.
            </p>
          )}
        </section>

        <section
          className={clsx(
            "rounded-3xl border border-snow/[0.08] bg-surface p-5 shadow-[0_2px_10px_var(--shadow-color)]",
            dragging && added.includes(dragging) && "ring-2 ring-snow/20",
          )}
          onDragOver={(e) =>
            dragging && added.includes(dragging) && e.preventDefault()
          }
          onDrop={() => {
            if (dragging && added.includes(dragging))
              setAdded((list) => list.filter((id) => id !== dragging));
            setDragging(null);
          }}
        >
          <p className="mb-3 text-[14px] font-semibold">
            Entwürfe ohne Termin{" "}
            <span className="font-normal text-snow/50 tabular-nums">
              ({tray.length})
            </span>
          </p>
          {!tray.length ? (
            <p className="text-[12.5px] text-snow/55">
              Keine Entwürfe ohne Termin.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {tray.map((post) => {
                const image = firstImage(post.media);
                return (
                  <button
                    key={post.id}
                    type="button"
                    draggable
                    onDragStart={() => setDragging(post.id)}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => onOpen(post)}
                    title={post.caption.slice(0, 120) || "Ohne Text"}
                    className="group relative aspect-[3/4] cursor-grab overflow-hidden rounded-xl bg-snow/[0.06] active:cursor-grabbing"
                  >
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="line-clamp-5 p-2 text-left text-[11px] text-snow/60">
                        {post.caption || "Ohne Text"}
                      </span>
                    )}
                    <GripVertical className="absolute top-1.5 right-1.5 h-4 w-4 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </aside>

      {preview !== null && tiles[preview] && (
        <FeedPreview
          key={preview}
          tiles={tiles}
          index={preview}
          onIndex={setPreview}
          onClose={() => setPreview(null)}
          onEdit={(post) => {
            setPreview(null);
            onOpen(post);
          }}
        />
      )}
    </div>
  );
}

function FeedTile({
  tile,
  dragging,
  over,
  slot,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onOpen,
  onRemove,
  occasions,
}: {
  tile: Tile;
  dragging: boolean;
  over: boolean;
  slot?: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onOpen: () => void;
  onRemove?: () => void;
  occasions: Map<string, string>;
}) {
  const plan = tile.kind === "plan";
  const media = plan ? tile.post.media : (tile.media ?? []);
  const image = plan ? firstImage(media) : tile.image;
  const type = plan
    ? media.some((m) => m.kind === "video")
      ? "video"
      : media.length > 1 || tile.post.format === "carousel"
        ? "carousel"
        : "image"
    : tile.type;
  const caption = plan ? tile.post.caption : tile.caption;
  const moved = plan && slot && tile.post.scheduled_at !== slot;
  // Liegt ein Anlass-Post nicht mehr auf seinem Tag?
  const occasion =
    plan && tile.post.day_id ? occasions.get(tile.post.day_id) : undefined;
  const offDay = !!(occasion && slot && isoDay(new Date(slot)) !== occasion);

  return (
    <div
      className={clsx(
        "group relative aspect-[3/4] bg-surface",
        dragging && "opacity-40",
        over && "outline-2 -outline-offset-2 outline-snow",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <button
        type="button"
        draggable={plan}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        aria-label={
          plan
            ? `Geplanter Post ${slot ? shortDate(slot) : ""}: ${caption.slice(0, 60)}`
            : `Beitrag: ${caption.slice(0, 60)}`
        }
        className={clsx(
          "block h-full w-full overflow-hidden",
          plan && "cursor-grab active:cursor-grabbing",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Medien aus Storage bzw. Instagram
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center bg-snow/[0.05] p-3 text-left text-[11.5px] leading-snug text-snow/60">
            <span className="line-clamp-6">{caption || "Ohne Bild"}</span>
          </span>
        )}
      </button>
      {/* Typ wie bei Instagram oben rechts */}
      <span className="pointer-events-none absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
        {type === "carousel" ? (
          <Layers className="h-4 w-4" />
        ) : type === "video" ? (
          <Clapperboard className="h-4 w-4" />
        ) : null}
      </span>
      {plan ? (
        <span className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-center gap-1 whitespace-nowrap bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-5 pb-1 text-[10.5px] font-medium text-white">
          {tile.post.created_by === "tage-agent" && (
            <Sparkles className="h-3 w-3" />
          )}
          {slot ? shortDate(slot) : "–"}
          <span className="ml-auto flex gap-1 whitespace-nowrap">
            {tile.post.status === "draft" && !offDay && (
              <span className="rounded bg-white/25 px-1">Entwurf</span>
            )}
            {offDay ? (
              // Posts zu einem Anlass (Tage-Autopilot) gehören auf ihren Tag
              <span
                className="rounded bg-[#d9822b] px-1"
                title={`Gehört zum Anlass am ${shortDate(`${occasion}T12:00:00`)}`}
              >
                Anlass
              </span>
            ) : (
              moved && (
                <span
                  className="rounded bg-[#d9822b] px-1"
                  title="Neuer Termin nach dem Übernehmen"
                >
                  neu
                </span>
              )
            )}
          </span>
        </span>
      ) : (
        <Lock
          className="pointer-events-none absolute bottom-1.5 left-1.5 h-3 w-3 text-white/80 opacity-0 drop-shadow transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      )}
      {plan && tile.added && (
        <span className="pointer-events-none absolute inset-0 border-2 border-dashed border-white/70" />
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Wieder aus dem Feed nehmen"
          className="absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** Vorschau eines Beitrags; Karussells lassen sich wischen (Maus, Touch, Pfeiltasten) */
function FeedPreview({
  tiles,
  index,
  onIndex,
  onClose,
  onEdit,
}: {
  tiles: Tile[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onEdit: (post: SocialPost) => void;
}) {
  const tile = tiles[index];
  const media = tile.kind === "plan" ? tile.post.media : (tile.media ?? []);
  const slides = media.filter((m) => m.url).length
    ? media.filter((m) => m.url)
    : [
        {
          url: tile.kind === "online" ? tile.image : null,
          kind: "image",
        } as MediaItem,
      ];
  const [slide, setSlide] = useState(0);
  const start = useRef<number | null>(null);
  const caption = tile.kind === "plan" ? tile.post.caption : tile.caption;
  const post = tile.kind === "plan" ? tile.post : tile.post;
  const go = (delta: number) =>
    setSlide((s) => Math.min(Math.max(s + delta, 0), slides.length - 1));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight")
        slide < slides.length - 1
          ? go(1)
          : index < tiles.length - 1 && onIndex(index + 1);
      else if (e.key === "ArrowLeft")
        slide > 0 ? go(-1) : index > 0 && onIndex(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Beitrag"
        className="flex max-h-[92vh] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative aspect-[4/5] touch-pan-y overflow-hidden bg-black select-none"
          onPointerDown={(e) => (start.current = e.clientX)}
          onPointerUp={(e) => {
            if (start.current === null) return;
            const dx = e.clientX - start.current;
            start.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          <div
            className="flex h-full transition-transform duration-300"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {slides.map((m, i) =>
              m.kind === "video" && m.url ? (
                <video
                  key={i}
                  src={m.url}
                  className="h-full w-full shrink-0 object-cover"
                  controls={i === slide}
                  muted
                  playsInline
                />
              ) : m.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- Medien aus Storage bzw. Instagram
                <img
                  key={i}
                  src={m.url}
                  alt=""
                  className="h-full w-full shrink-0 object-cover"
                  draggable={false}
                />
              ) : (
                <div
                  key={i}
                  className="grid h-full w-full shrink-0 place-items-center p-6 text-center text-[13px] text-white/70"
                >
                  {caption || "Ohne Bild"}
                </div>
              ),
            )}
          </div>
          {slides.length > 1 && (
            <>
              {slide > 0 && (
                <button
                  type="button"
                  aria-label="Vorheriges Bild"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {slide < slides.length - 1 && (
                <button
                  type="button"
                  aria-label="Nächstes Bild"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
                {slide + 1}/{slides.length}
              </span>
              <span className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={clsx(
                      "h-1.5 w-1.5 rounded-full",
                      i === slide ? "bg-white" : "bg-white/45",
                    )}
                  />
                ))}
              </span>
            </>
          )}
        </div>
        <div className="min-h-0 overflow-y-auto p-4">
          <p className="text-[12px] text-snow/50">
            {tile.kind === "plan"
              ? `Geplant ${tile.post.scheduled_at ? shortDate(tile.post.scheduled_at) : ""}`
              : tile.date
                ? `Online seit ${shortDate(tile.date)}`
                : "Online"}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">
            {caption || "Ohne Text"}
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-snow/[0.08] p-3">
          <Button
            size="sm"
            variant="ghost"
            icon={<ChevronLeft className="h-4 w-4" />}
            disabled={index === 0}
            onClick={() => onIndex(index - 1)}
          >
            Zurück
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={index >= tiles.length - 1}
            onClick={() => onIndex(index + 1)}
          >
            Weiter <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="flex-1" />
          {post && EDITABLE.includes(post.status) && (
            <Button
              size="sm"
              variant="primary"
              icon={<PenLine className="h-4 w-4" />}
              onClick={() => onEdit(post)}
            >
              Bearbeiten
            </Button>
          )}
          {tile.kind === "online" && tile.url && (
            <a
              href={tile.url}
              target="_blank"
              rel="noopener"
              className="text-[13px] font-medium underline underline-offset-2"
            >
              Auf Instagram
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
