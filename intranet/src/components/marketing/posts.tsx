"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarClock, ImagePlus, Palette, Plus, Send, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { POST_STATUS, PROVIDERS, type MediaItem, type SocialAccount, type SocialPost } from "@/lib/marketing";
import { Badge, Button, Dialog, Empty, IconButton, Input, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { ProviderMark, useMarketingStatus } from "./common";
import { URL_WORKSPACES, useCurrentWorkspace, WorkspaceSwitcher } from "./workspace";

const postsUrl = (workspaceId: string) => `/api/marketing/posts?workspace=${workspaceId}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

/** Marketing → Posts & Planung der aktuellen Kundenwelt */
export function Posts() {
  const { workspace } = useCurrentWorkspace();
  const posts = useResource<SocialPost[]>(workspace ? postsUrl(workspace.id) : null);
  const [editing, setEditing] = useState<SocialPost | "new" | null>(null);

  const groups = useMemo(() => {
    const list = posts.data ?? [];
    const upcoming = list.filter((p) => ["draft", "scheduled", "publishing", "failed", "partial"].includes(p.status));
    upcoming.sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"));
    return { upcoming, done: list.filter((p) => p.status === "published") };
  }, [posts.data]);

  if (!workspace) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const accounts = workspace.accounts.filter((a) => a.provider !== "canva");

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Posts & Planung" meta={workspace.name}>
        <WorkspaceSwitcher />
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
          Neuer Post
        </Button>
      </PageBar>
      {posts.error ? (
        <Empty title="Posts konnten nicht geladen werden" text={posts.error.message} />
      ) : posts.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          {!accounts.length && (
            <p className="mx-4 mt-4 max-w-3xl rounded-xl bg-snow/[0.06] px-3.5 py-2.5 text-[13px] text-snow/75 md:mx-6">
              Für {workspace.name} ist noch kein Kanal verbunden. Unter „Kanäle“ einen Link für den Kunden erstellen.
            </p>
          )}
          <Section title="Geplant & Entwürfe" posts={groups.upcoming} accounts={accounts} onOpen={setEditing} empty="Nichts geplant." />
          <Section title="Veröffentlicht" posts={groups.done} accounts={accounts} onOpen={setEditing} empty="Noch nichts veröffentlicht." />
        </div>
      )}
      {editing && (
        <Composer
          key={editing === "new" ? "new" : editing.id}
          post={editing === "new" ? null : editing}
          workspaceId={workspace.id}
          accounts={accounts}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Section({ title, posts, accounts, onOpen, empty }: { title: string; posts: SocialPost[]; accounts: SocialAccount[]; onOpen: (p: SocialPost) => void; empty: string }) {
  return (
    <section>
      <h2 className="px-4 pt-6 pb-2 text-[15px] font-medium md:px-6">
        {title} <span className="text-[13px] font-normal text-snow/50">{posts.length}</span>
      </h2>
      {posts.length === 0 ? (
        <p className="px-4 text-[13px] text-snow/55 md:px-6">{empty}</p>
      ) : (
        <ul className="border-t border-snow/[0.06]">
          {posts.map((post) => (
            <li key={post.id}>
              <PostRow post={post} accounts={accounts} onOpen={() => onOpen(post)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PostRow({ post, accounts, onOpen }: { post: SocialPost; accounts: SocialAccount[]; onOpen: () => void }) {
  const status = POST_STATUS[post.status];
  const errors = Object.entries(post.results).filter(([, r]) => r.status === "failed");
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 border-b border-snow/[0.06] px-4 py-3 text-left hover:bg-snow/[0.03] md:px-6">
      <div className="flex w-16 shrink-0 gap-1">
        {post.media.slice(0, 1).map((m) =>
          m.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage
            <img key={m.path} src={m.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <video key={m.path} src={m.url} className="h-16 w-16 rounded-lg object-cover" muted />
          )
        )}
        {!post.media.length && <span className="grid h-16 w-16 place-items-center rounded-lg bg-snow/[0.06] text-[11px] text-snow/45">Text</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={status.color}>{status.label}</Badge>
          <span className="text-[12.5px] text-snow/60">{post.status === "published" ? when(post.published_at) : post.scheduled_at ? when(post.scheduled_at) : "ohne Termin"}</span>
          <span className="ml-auto flex gap-1">
            {post.account_ids.map((id) => {
              const account = accounts.find((a) => a.id === id);
              const result = post.results[id];
              return account ? (
                <ProviderMark key={id} provider={account.provider} className={clsx(result?.status === "failed" && "ring-1 ring-error")} />
              ) : null;
            })}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[14px] text-snow/85">{post.caption || "Ohne Text"}</p>
        {errors.length > 0 && (
          <p className="mt-1 line-clamp-2 text-[12.5px] text-error">
            {errors.map(([id, r]) => `${PROVIDERS[accounts.find((a) => a.id === id)?.provider ?? "instagram"].label}: ${r.error}`).join(" · ")}
          </p>
        )}
        {post.created_by === "agent" && <p className="mt-1 text-[11.5px] text-snow/45">vom Agenten</p>}
      </div>
    </button>
  );
}

/** Für <input type="datetime-local">: ISO ↔ lokale Zeit */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function Composer({ post, workspaceId, accounts, onClose }: { post: SocialPost | null; workspaceId: string; accounts: SocialAccount[]; onClose: () => void }) {
  const toast = useToast();
  const status = useMarketingStatus();
  const locked = post ? !["draft", "scheduled", "failed"].includes(post.status) : false;
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [media, setMedia] = useState<MediaItem[]>(post?.media ?? []);
  const [selected, setSelected] = useState<string[]>(post?.account_ids ?? accounts.filter((a) => a.status === "active").map((a) => a.id));
  const [at, setAt] = useState(toLocal(post?.scheduled_at ?? null));
  const [busy, setBusy] = useState<string | null>(null);
  const [canva, setCanva] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => {
    revalidate(postsUrl(workspaceId));
    revalidate(URL_WORKSPACES);
  };

  async function upload(file: File) {
    setBusy("upload");
    try {
      const { upload_url, item } = await api<{ upload_url: string | null; item: MediaItem }>("/api/marketing/media/upload-url", {
        method: "POST",
        body: JSON.stringify({ name: file.name, mime: file.type }),
      });
      if (upload_url) {
        const response = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!response.ok) throw new Error(`Hochladen fehlgeschlagen (${response.status})`);
        setMedia((list) => [...list, item]);
      } else {
        // Vorschau ohne Storage: kleine Dateien direkt
        const form = new FormData();
        form.append("file", file);
        setMedia((list) => [...list, item]);
        await api("/api/marketing/media", { method: "POST", body: form });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Hochladen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function save(mode: "draft" | "schedule" | "now") {
    if (mode !== "draft" && !selected.length) return toast("Mindestens einen Kanal wählen", "error");
    if (mode === "schedule" && !at) return toast("Zeitpunkt wählen", "error");
    setBusy(mode);
    const body = {
      workspace_id: workspaceId,
      caption,
      media,
      account_ids: selected,
      scheduled_at: at ? new Date(at).toISOString() : null,
      status: mode === "schedule" ? "scheduled" : "draft",
    };
    try {
      let saved = post
        ? await api<SocialPost>(`/api/marketing/posts/${post.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<SocialPost>("/api/marketing/posts", { method: "POST", body: JSON.stringify(body) });
      if (mode === "now") saved = await api<SocialPost>(`/api/marketing/posts/${saved.id}/publish`, { method: "POST" });
      mutate<SocialPost[]>(postsUrl(workspaceId), (list) => [saved, ...list.filter((p) => p.id !== saved.id)]);
      refresh();
      toast(mode === "now" ? POST_STATUS[saved.status].label : mode === "schedule" ? `Geplant für ${when(saved.scheduled_at)}` : "Entwurf gespeichert");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function retry() {
    if (!post) return;
    setBusy("now");
    try {
      const saved = await api<SocialPost>(`/api/marketing/posts/${post.id}/publish`, { method: "POST" });
      refresh();
      toast(POST_STATUS[saved.status].label);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!post) return;
    setBusy("delete");
    try {
      await api(`/api/marketing/posts/${post.id}`, { method: "DELETE" });
      mutate<SocialPost[]>(postsUrl(workspaceId), (list) => list.filter((p) => p.id !== post.id));
      refresh();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={post ? (locked ? "Post" : "Post bearbeiten") : "Neuer Post"}
      width="max-w-2xl"
      footer={
        locked ? (
          <>
            {post && post.status === "partial" && (
              <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === "now"} loadingText="Wird gepostet …" onClick={retry}>
                Fehlende Kanäle erneut
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Schließen
            </Button>
          </>
        ) : (
          <>
            {post && (
              <Button variant="ghost" className="mr-auto text-error" icon={<Trash2 className="h-4 w-4" />} loading={busy === "delete"} loadingText="Wird gelöscht …" onClick={remove}>
                Löschen
              </Button>
            )}
            <Button variant="ghost" loading={busy === "draft"} loadingText="Wird gespeichert …" disabled={busy !== null} onClick={() => save("draft")}>
              Entwurf
            </Button>
            <Button icon={<CalendarClock className="h-4 w-4" />} loading={busy === "schedule"} loadingText="Wird geplant …" disabled={busy !== null} onClick={() => save("schedule")}>
              Planen
            </Button>
            <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === "now"} loadingText="Wird gepostet …" disabled={busy !== null} onClick={() => save("now")}>
              Jetzt posten
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-4">
        <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} placeholder="Text, Hashtags …" aria-label="Text" disabled={locked} className="w-full" />
        <div>
          <p className="mb-2 text-xs font-medium text-snow/60">Medien</p>
          <div className="flex flex-wrap gap-2">
            {media.map((m) => (
              <div key={m.path} className="relative">
                {m.kind === "image" && m.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage
                  <img src={m.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-20 w-20 place-items-center rounded-lg bg-snow/[0.06] text-[11px] text-snow/55">{m.kind === "video" ? "Video" : "Bild"}</span>
                )}
                {!locked && (
                  <IconButton label="Entfernen" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-sky shadow" onClick={() => setMedia((list) => list.filter((x) => x.path !== m.path))}>
                    <X className="h-3.5 w-3.5" />
                  </IconButton>
                )}
              </div>
            ))}
            {!locked && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                  }}
                />
                <Button className="h-20" icon={<ImagePlus className="h-4 w-4" />} loading={busy === "upload"} loadingText="Lädt hoch …" onClick={() => fileInput.current?.click()}>
                  Datei
                </Button>
                <Button className="h-20" icon={<Palette className="h-4 w-4" />} disabled={!status.data?.canva} title={status.data?.canva ? undefined : "Canva ist noch nicht verbunden"} onClick={() => setCanva(true)}>
                  Aus Canva
                </Button>
              </>
            )}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-snow/60">Kanäle</p>
          {accounts.length ? (
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const on = selected.includes(a.id);
                const result = post?.results[a.id];
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={locked || a.status === "error"}
                    aria-pressed={on}
                    onClick={() => setSelected((list) => (on ? list.filter((x) => x !== a.id) : [...list, a.id]))}
                    title={result?.error ?? a.error ?? undefined}
                    className={clsx(
                      "flex h-9 items-center gap-2 rounded-full border pr-3 pl-1.5 text-[13px] disabled:opacity-50",
                      on ? "border-snow bg-snow/[0.1]" : "border-snow/15 text-snow/65 hover:border-snow/35"
                    )}
                  >
                    <ProviderMark provider={a.provider} />
                    {a.handle ?? a.name}
                    {result && <span className={result.status === "failed" ? "text-error" : "text-[#30a46c]"}>{result.status === "failed" ? "✕" : "✓"}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-snow/55">Noch keine Kanäle verbunden.</p>
          )}
        </div>
        {!locked && (
          <label className="flex flex-wrap items-center gap-3 text-[13px] text-snow/70">
            Zeitpunkt
            <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="h-9 w-auto" />
            <span className="text-[12px] text-snow/50">Geplante Posts gehen zur nächsten vollen Stunde raus (ca. 7–22 Uhr).</span>
          </label>
        )}
        {post && Object.values(post.results).some((r) => r.url) && (
          <div className="flex flex-wrap gap-2 text-[13px]">
            {Object.entries(post.results)
              .filter(([, r]) => r.url)
              .map(([id, r]) => (
                <a key={id} href={r.url} target="_blank" rel="noopener" className="underline underline-offset-2">
                  {PROVIDERS[accounts.find((a) => a.id === id)?.provider ?? "instagram"].label} öffnen
                </a>
              ))}
          </div>
        )}
      </div>
      {canva && <CanvaPicker workspaceId={workspaceId} onClose={() => setCanva(false)} onPicked={(items) => setMedia((list) => [...list, ...items])} />}
    </Dialog>
  );
}

type Design = { id: string; title: string; thumbnail: string | null; edit_url: string | null };

function CanvaPicker({ workspaceId, onClose, onPicked }: { workspaceId: string; onClose: () => void; onPicked: (media: MediaItem[]) => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const designs = useResource<{ items: Design[] }>(`/api/marketing/canva/designs${search ? `?query=${encodeURIComponent(search)}` : ""}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(design: Design, format: "png" | "mp4") {
    setBusy(`${design.id}:${format}`);
    try {
      const { media } = await api<{ media: MediaItem[] }>("/api/marketing/canva/export", { method: "POST", body: JSON.stringify({ design_id: design.id, format }) });
      onPicked(media);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Export fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function create() {
    setBusy("new");
    try {
      const design = await api<Design>("/api/marketing/canva/designs", { method: "POST", body: JSON.stringify({ title: query || "Neuer Post", workspace_id: workspaceId }) });
      if (design.edit_url) window.open(design.edit_url, "_blank", "noopener");
      designs.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog open onClose={onClose} title="Aus Canva" width="max-w-2xl">
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Design suchen …" aria-label="Design suchen" className="h-9 flex-1" />
        <Button type="submit" size="sm" className="h-9">
          Suchen
        </Button>
        <Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} loading={busy === "new"} loadingText="Wird angelegt …" onClick={create}>
          Neu (1080 × 1350)
        </Button>
      </form>
      {designs.error ? (
        <p className="text-[13px] text-error">{designs.error.message}</p>
      ) : designs.loading ? (
        <Spinner />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(designs.data?.items ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border border-snow/[0.08] p-2">
              {d.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- Vorschaubild von Canva
                <img src={d.thumbnail} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <span className="grid aspect-square w-full place-items-center rounded-lg bg-snow/[0.06] text-[12px] text-snow/50">Canva</span>
              )}
              <p className="mt-1.5 truncate text-[13px]">{d.title}</p>
              <div className="mt-1.5 flex gap-1.5">
                <Button size="sm" className="flex-1" loading={busy === `${d.id}:png`} loadingText="Export …" disabled={busy !== null} onClick={() => pick(d, "png")}>
                  Bild
                </Button>
                <Button size="sm" className="flex-1" loading={busy === `${d.id}:mp4`} loadingText="Export …" disabled={busy !== null} onClick={() => pick(d, "mp4")}>
                  Video
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
