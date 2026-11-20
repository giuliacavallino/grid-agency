"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, Copy, ExternalLink, Heart, MessageCircle, Pencil, Play, RefreshCw, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import {
  CONNECTORS,
  PROFILE_PROVIDERS,
  PROVIDERS,
  profileHandle,
  profileUrl,
  type ChannelProfile,
  type PostProvider,
  type ProfileLinks,
  type ProfilePost,
  type ProfileResponse,
} from "@/lib/marketing";
import { accentFill, accentText } from "@/lib/theme";
import { Button, Field, IconButton, Input, Sheet, Spinner, useToast } from "@/components/ui";
import { ProviderMark, useMarketingStatus } from "@/components/marketing/common";
import { URL_WORKSPACES, type WorkspaceSummary } from "@/components/marketing/workspace";
import { akteUrl } from "./shell";

// Kanäle im Cockpit: vier Kacheln (Instagram, TikTok, Facebook, LinkedIn).
// Verbunden: Profil wie in der App im Seitenpanel. Nur Link hinterlegt: das
// Profil auf der Plattform öffnen. Weder noch: Link hinterlegen oder verbinden.

const plain = new Intl.NumberFormat("de-DE");
const compact = new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 });
const thousands = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
/** Zahlen wie in den Apps: 2.480 · 12,5 Tsd. · 1,3 Mio. */
const number = { format: (n: number) => (n < 10_000 ? plain.format(n) : n < 1_000_000 ? `${thousands.format(n / 1000)} Tsd.` : compact.format(n)) };
const shortDate = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });

const PLACEHOLDER: Record<PostProvider, string> = {
  instagram: "instagram.com/name oder @name",
  tiktok: "tiktok.com/@name oder @name",
  facebook: "facebook.com/name oder name",
  linkedin: "linkedin.com/company/name oder name",
};

const accountFor = (workspace: WorkspaceSummary, provider: PostProvider) =>
  workspace.accounts.find((a) => a.provider === provider && a.status === "active") ?? null;

const brokenFor = (workspace: WorkspaceSummary, provider: PostProvider) =>
  workspace.accounts.find((a) => a.provider === provider && a.status === "error") ?? null;

const profileApi = (workspaceId: string, provider: PostProvider) => `${URL_WORKSPACES}/${workspaceId}/profile?provider=${provider}`;

/** Die vier Kanal-Kacheln samt Seitenpanel */
export function ChannelTiles({ workspace }: { workspace: WorkspaceSummary }) {
  const [open, setOpen] = useState<PostProvider | null>(null);

  function pick(provider: PostProvider) {
    const stored = workspace.profiles?.[provider];
    if (!accountFor(workspace, provider) && stored) {
      window.open(stored, "_blank", "noopener,noreferrer");
      return;
    }
    setOpen(provider);
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-2">
        {PROFILE_PROVIDERS.map((provider) => {
          const account = accountFor(workspace, provider);
          const broken = !account && brokenFor(workspace, provider);
          const stored = workspace.profiles?.[provider];
          const status = account
            ? (account.handle ?? "verbunden")
            : broken
              ? "Verbindung gestört"
              : stored
                ? (profileHandle(provider, stored) ?? "Profil öffnen")
                : "nicht verbunden";
          return (
            <li key={provider} className="relative">
              <button
                type="button"
                onClick={() => pick(provider)}
                className="flex w-full flex-col items-start gap-2 rounded-xl border border-snow/[0.08] bg-snow/[0.03] p-3 text-left transition-colors hover:border-snow/20 hover:bg-snow/[0.06] focus-visible:outline-2 focus-visible:outline-snow"
                aria-label={`${PROVIDERS[provider].label}: ${status}`}
              >
                <span className="flex w-full items-center gap-2">
                  <ProviderMark provider={provider} className="h-8 min-w-8 rounded-lg text-[12px]" />
                  {account?.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- Profilbild der Plattform
                    <img src={account.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" referrerPolicy="no-referrer" />
                  )}
                </span>
                <span className="w-full min-w-0">
                  <span className="block text-[13.5px] font-medium">{PROVIDERS[provider].label}</span>
                  <span className={clsx("flex items-center gap-1.5 text-[12px]", broken ? "text-error" : account ? "text-snow/70" : "text-snow/45")}>
                    {account && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />}
                    <span className="truncate">{status}</span>
                    {!account && stored && <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />}
                  </span>
                </span>
              </button>
              {!account && stored && (
                <IconButton
                  label={`${PROVIDERS[provider].label}-Link ändern`}
                  className="absolute top-2 right-2 h-7 w-7 text-snow/45 hover:text-snow"
                  onClick={() => setOpen(provider)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </li>
          );
        })}
      </ul>
      {open && <ProfileSheet key={open} workspace={workspace} provider={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Seitenpanel: Profil (verbunden) oder Einrichtung (nicht verbunden) */
export function ProfileSheet({ workspace, provider, onClose }: { workspace: WorkspaceSummary; provider: PostProvider; onClose: () => void }) {
  const connected = !!accountFor(workspace, provider);
  const resource = useResource<ProfileResponse>(connected ? profileApi(workspace.id, provider) : null);
  const { reload } = resource;
  // Beim Öffnen frisch laden; Daten aus dem letzten Öffnen stehen solange da
  useEffect(() => {
    if (connected) reload();
  }, [connected, reload]);
  const busy = resource.loading || (connected && !resource.data && !resource.error);

  return (
    <Sheet
      open
      onClose={onClose}
      title={PROVIDERS[provider].label}
      subtitle={workspace.name}
      width="max-w-[480px]"
      actions={
        connected && resource.data ? (
          <IconButton label="Neu laden" onClick={() => reload()}>
            <RefreshCw className={clsx("h-4 w-4", resource.loading && "animate-spin")} />
          </IconButton>
        ) : undefined
      }
    >
      {!connected ? (
        <Setup workspace={workspace} provider={provider} />
      ) : resource.data?.profile ? (
        <Profile provider={provider} data={resource.data} profile={resource.data.profile} />
      ) : resource.error ? (
        <LoadError message={resource.error.message} onRetry={() => reload()} />
      ) : busy ? (
        <div className="grid place-items-center gap-3 py-24 text-[13px] text-snow/55" aria-busy>
          <Spinner className="h-6 w-6" />
          Profil wird geladen …
        </div>
      ) : (
        <LoadError message="Keine Profildaten erhalten." onRetry={() => reload()} />
      )}
    </Sheet>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => Promise<void> | undefined }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="grid place-items-center gap-3 px-6 py-20 text-center">
      <CircleAlert className="h-6 w-6 text-error" />
      <p className="max-w-sm text-[13.5px] text-snow/75">Profil konnte nicht geladen werden. {message}</p>
      <Button
        size="sm"
        icon={<RefreshCw className="h-4 w-4" />}
        loading={retrying}
        loadingText="Wird geladen …"
        onClick={async () => {
          setRetrying(true);
          await onRetry();
          setRetrying(false);
        }}
      >
        Erneut versuchen
      </Button>
    </div>
  );
}

function Stat({ value, label }: { value: number | undefined; label: string }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="min-w-0 text-center">
      <p className="text-[17px] leading-tight font-semibold tabular-nums">{number.format(value)}</p>
      <p className="text-[12px] text-snow/55">{label}</p>
    </div>
  );
}

function Profile({ provider, data, profile }: { provider: PostProvider; data: ProfileResponse; profile: ChannelProfile }) {
  const posts = data.posts ?? [];
  const url = profile.url ?? data.url;
  const color = PROVIDERS[provider].color;
  return (
    <div className="pb-8">
      <div className="px-5 pt-5">
        <div className="flex items-center gap-5">
          <div className="shrink-0 rounded-full p-[3px]" style={{ background: provider === "instagram" ? "var(--aurora)" : accentFill(color, 55) }}>
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- Profilbild der Plattform
              <img src={profile.avatar} alt="" className="h-[84px] w-[84px] rounded-full border-[3px] border-sky bg-panel object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-[84px] w-[84px] place-items-center rounded-full border-[3px] border-sky bg-panel text-2xl font-semibold">{profile.name.slice(0, 1)}</span>
            )}
          </div>
          <div className="grid flex-1 grid-cols-3 gap-2">
            <Stat value={profile.posts} label={provider === "tiktok" ? "Videos" : "Beiträge"} />
            <Stat value={profile.followers} label="Follower" />
            <Stat value={profile.following} label="Gefolgt" />
          </div>
        </div>
        <p className="mt-3 text-[14.5px] font-semibold">{profile.name}</p>
        {profile.handle && <p className="text-[13px] text-snow/55">{profile.handle}</p>}
        {profile.bio && <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-line text-snow/85">{profile.bio}</p>}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex h-9 items-center justify-center gap-2 rounded-xl border border-snow/15 bg-snow/[0.06] text-[13px] font-medium hover:bg-snow/[0.12]"
          >
            Auf {PROVIDERS[provider].label} öffnen <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {data.error && (
          <p className="mt-3 flex gap-2 rounded-xl bg-snow/[0.05] px-3 py-2.5 text-[12.5px] leading-snug text-snow/70">
            <CircleAlert className="mt-px h-4 w-4 shrink-0" style={{ color: accentText("#f5a524") }} />
            <span>{data.error}</span>
          </p>
        )}
      </div>

      <div className="mt-5 border-t border-snow/10">
        {posts.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-snow/50">Keine Beiträge gefunden.</p>
        ) : provider === "linkedin" ? (
          <ul className="grid gap-3 p-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-3 gap-0.5 pt-0.5">
            {posts.map((post) => (
              <PostTile key={post.id} post={post} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Counts({ post, className }: { post: ProfilePost; className?: string }) {
  if (post.likes === undefined && post.comments === undefined) return null;
  return (
    <span className={clsx("flex items-center gap-3 text-[13px] font-semibold tabular-nums", className)}>
      {post.likes !== undefined && (
        <span className="flex items-center gap-1">
          <Heart className="h-4 w-4 fill-current" aria-label="Gefällt" /> {number.format(post.likes)}
        </span>
      )}
      {post.comments !== undefined && (
        <span className="flex items-center gap-1">
          <MessageCircle className="h-4 w-4 fill-current" aria-label="Kommentare" /> {number.format(post.comments)}
        </span>
      )}
    </span>
  );
}

const postLabel = (post: ProfilePost) => [post.caption.slice(0, 80) || "Beitrag", post.date && shortDate.format(new Date(post.date))].filter(Boolean).join(" · ");

/** Quadrat im Raster wie in der App; Hover (oder Touch: immer) zeigt Likes/Kommentare */
function PostTile({ post }: { post: ProfilePost }) {
  const Tag = post.url ? "a" : "div";
  return (
    <li>
      <Tag
        {...(post.url ? { href: post.url, target: "_blank", rel: "noopener noreferrer" } : {})}
        title={postLabel(post)}
        aria-label={postLabel(post)}
        className="group relative block aspect-square overflow-hidden bg-snow/[0.06] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-snow"
      >
        {post.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Bilder der Plattform
          <img src={post.image} alt="" loading="lazy" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="line-clamp-6 p-2.5 text-[11.5px] leading-snug text-snow/75">{post.caption || "Beitrag ohne Text"}</span>
        )}
        {(post.type === "video" || post.type === "carousel") && (
          <span className="absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]" aria-label={post.type === "video" ? "Video" : "Mehrere Bilder"}>
            {post.type === "video" ? <Play className="h-4 w-4 fill-current" /> : <Copy className="h-4 w-4" />}
          </span>
        )}
        {/* Über Fotos immer helle Schrift auf dunklem Schleier, wie in der App */}
        {post.image && (
          <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:hidden">
            <Counts post={post} />
          </span>
        )}
        {post.image && (
          <span className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-white pointer-coarse:block">
            <Counts post={post} className="gap-2 text-[11px] [&_svg]:h-3 [&_svg]:w-3" />
          </span>
        )}
      </Tag>
    </li>
  );
}

/** LinkedIn: Text steht im Vordergrund, daher Karten statt Raster */
function PostCard({ post }: { post: ProfilePost }) {
  const Tag = post.url ? "a" : "div";
  return (
    <li>
      <Tag
        {...(post.url ? { href: post.url, target: "_blank", rel: "noopener noreferrer" } : {})}
        className="block overflow-hidden rounded-xl border border-snow/[0.08] bg-panel transition-colors hover:border-snow/20"
      >
        {post.image && (
          // eslint-disable-next-line @next/next/no-img-element -- Bilder der Plattform
          <img src={post.image} alt="" loading="lazy" className="aspect-[1.91/1] w-full object-cover" referrerPolicy="no-referrer" />
        )}
        <div className="p-3">
          {post.date && <p className="text-[11.5px] text-snow/50">{shortDate.format(new Date(post.date))}{post.type === "video" ? " · Video" : ""}</p>}
          <p className="mt-0.5 line-clamp-4 text-[13px] leading-relaxed whitespace-pre-line">{post.caption || "Beitrag ohne Text"}</p>
          <Counts post={post} className="mt-2 font-medium text-snow/60" />
        </div>
      </Tag>
    </li>
  );
}

/** Nicht verbunden: Profil-Link hinterlegen oder den Kanal verbinden */
function Setup({ workspace, provider }: { workspace: WorkspaceSummary; provider: PostProvider }) {
  const toast = useToast();
  const status = useMarketingStatus();
  const stored = workspace.profiles?.[provider] ?? "";
  const broken = brokenFor(workspace, provider);
  const [value, setValue] = useState(stored);
  const [busy, setBusy] = useState<"save" | "remove" | "connect" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const label = PROVIDERS[provider].label;
  const connector = CONNECTORS.find((c) => c.providers.includes(provider))!;
  const ready = status.data?.configured[connector.id];
  const preview = value.trim() ? profileUrl(provider, value) : null;

  async function save(next: string | null) {
    setBusy(next === null ? "remove" : "save");
    setProblem(null);
    try {
      const { profiles } = await api<{ profiles: ProfileLinks }>(`${URL_WORKSPACES}/${workspace.id}/profiles`, { method: "PATCH", body: JSON.stringify({ [provider]: next }) });
      // mutate trifft alle URLs mit diesem Anfang (auch …/autopilot); nur die Liste ändern
      mutate<WorkspaceSummary[]>(URL_WORKSPACES, (list) => (Array.isArray(list) ? list.map((w) => (w.id === workspace.id ? { ...w, profiles } : w)) : list));
      setValue(profiles[provider] ?? "");
      toast(next === null ? "Profil-Link entfernt" : "Profil-Link gespeichert");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    }
    setBusy(null);
  }

  async function connect() {
    setBusy("connect");
    try {
      const { url } = await api<{ url: string }>(`/api/marketing/connect/${connector.id}`, { method: "POST", body: JSON.stringify({ workspace_id: workspace.id }) });
      window.location.assign(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Verbinden fehlgeschlagen", "error");
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 p-5">
      <div className="flex items-center gap-3">
        <ProviderMark provider={provider} className="h-11 min-w-11 rounded-xl text-[14px]" />
        <div>
          <p className="text-[15px] font-semibold">Nicht verbunden</p>
          <p className={clsx("text-[13px]", broken ? "text-error" : "text-snow/55")}>{broken ? `Verbindung gestört: ${broken.error ?? "bitte neu verbinden"}` : `${workspace.name} hat noch kein ${label}-Konto im Hub.`}</p>
        </div>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          if (!preview) return setProblem(`Kein gültiger ${label}-Link oder Name`);
          save(value);
        }}
      >
        <div>
          <p className="text-[14px] font-medium">Profil hinterlegen</p>
          <p className="text-[12.5px] leading-snug text-snow/55">Dann öffnet die Kachel das Profil direkt auf {label}.</p>
        </div>
        <Field label="Profil-Link oder Name" hint={preview && preview !== stored ? `Wird gespeichert als ${preview}` : undefined}>
          {(id) => (
            <Input
              id={id}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setProblem(null);
              }}
              placeholder={PLACEHOLDER[provider]}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!!problem || undefined}
            />
          )}
        </Field>
        {problem && <p className="text-[12.5px] text-error">{problem}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" size="sm" loading={busy === "save"} loadingText="Wird gespeichert …" disabled={!value.trim() || busy !== null}>
            Speichern
          </Button>
          {stored && (
            <>
              <a href={stored} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-snow/75 hover:bg-snow/[0.08] hover:text-snow">
                Öffnen <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <Button variant="ghost" size="sm" className="ml-auto" loading={busy === "remove"} loadingText="Wird entfernt …" disabled={busy !== null} onClick={() => save(null)}>
                Entfernen
              </Button>
            </>
          )}
        </div>
      </form>

      <div className="grid gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-4">
        <div>
          <p className="text-[14px] font-medium">{label} verbinden</p>
          <p className="text-[12.5px] leading-snug text-snow/55">
            {status.data && !ready ? `In Vercel fehlen ${status.data.env[connector.id]}.` : `Mit Verbindung siehst du hier Profil und Beiträge und kannst posten. ${connector.text}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" loading={busy === "connect"} loadingText="Weiterleiten …" disabled={!ready || busy !== null} onClick={connect}>
            Jetzt verbinden
          </Button>
          <Link href={akteUrl(workspace.id, "einstellungen")} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-snow/75 hover:bg-snow/[0.08] hover:text-snow">
            <Settings2 className="h-3.5 w-3.5" /> Kanäle verwalten
          </Link>
        </div>
      </div>
    </div>
  );
}
