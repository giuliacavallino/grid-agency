"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, ImagePlus, Send, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { DEMO } from "@/lib/config";
import { POST_FORMATS, POST_STATUS, PROVIDERS, type MediaItem, type PostProvider, type Provider, type SocialAccount, type SocialPost } from "@/lib/marketing";
import { Badge, Button, IconButton, Input, Sheet, Spinner, useToast } from "@/components/ui";
import { CanvaAiDialog, CanvaMediaActions } from "./canva-ai";
import { CanvaPicker } from "./canva-picker";
import { CaptionAssist } from "./caption-assist";
import { CanvaButton, EmojiPicker, HashtagPicker } from "./composer-tools";
import { ProviderMark, useMarketingStatus } from "./common";
import { ImageEditor } from "./image-editor";
import { ReviewPanel } from "./review-panel";
import { URL_WORKSPACES, WorkspaceLogo, type WorkspaceSummary } from "./workspace";

// Editor rechts: links Text, Medien, Kanäle und Termin, rechts die Vorschau
// je Plattform. Speichert automatisch; „Planen“ und „Jetzt posten“ sind die
// einzigen bewussten Schritte.

export const postsUrl = (workspaceId: string) => `/api/marketing/posts?workspace=${workspaceId}&limit=500`;

/** Höchstlänge des Texts je Plattform */
const LIMITS: Partial<Record<Provider, number>> = { instagram: 2200, facebook: 63206, linkedin: 3000, tiktok: 2200 };

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (d: Date | null) => (d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "");
const toTime = (d: Date | null) => (d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "");

export function PostEditor({
  post: initial,
  initialDate,
  workspace,
  accounts,
  onClose,
}: {
  post: SocialPost | null;
  initialDate?: Date;
  workspace: WorkspaceSummary;
  accounts: SocialAccount[];
  onClose: () => void;
}) {
  const toast = useToast();
  const status = useMarketingStatus();
  const url = postsUrl(workspace.id);
  const [post, setPost] = useState<SocialPost | null>(initial);
  const locked = post ? !["draft", "scheduled", "failed"].includes(post.status) : false;
  const start = initial?.scheduled_at ? new Date(initial.scheduled_at) : initialDate ?? null;

  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [media, setMedia] = useState<MediaItem[]>(initial?.media ?? []);
  const [selected, setSelected] = useState<string[]>(initial?.account_ids ?? accounts.filter((a) => a.status === "active").map((a) => a.id));
  const [date, setDate] = useState(toDate(start));
  const [clock, setClock] = useState(toTime(start) || "18:00");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [canva, setCanva] = useState(false);
  const [canvaAi, setCanvaAi] = useState(false);
  const [assist, setAssist] = useState(false);
  /** Bearbeiten-Adressen frisch angelegter Canva-Designs (sonst per API geholt) */
  const [canvaUrls, setCanvaUrls] = useState<Record<string, string>>({});
  const [editingImage, setEditingImage] = useState<MediaItem | null>(null);
  const [preview, setPreview] = useState<Provider | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  /** Emoji an der Schreibmarke einfügen (sonst am Ende) */
  function insertAtCursor(text: string) {
    const el = textRef.current;
    const start = el?.selectionStart ?? caption.length;
    const end = el?.selectionEnd ?? caption.length;
    // Direkt nach einem Wort ein Leerzeichen davor, wie man es tippen würde
    const insert = /[\p{L}\p{N}.!?]$/u.test(caption.slice(0, start)) ? ` ${text}` : text;
    setCaption((c) => c.slice(0, start) + insert + c.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + insert.length, start + insert.length);
    });
  }
  const first = useRef(true);
  // Aktueller Stand für den Autosave (ohne den Effekt bei jedem Speichern neu zu starten)
  const postRef = useRef(initial);

  const scheduledAt = date ? new Date(`${date}T${clock || "18:00"}`).toISOString() : null;
  const channels = accounts.filter((a) => selected.includes(a.id));
  const limit = Math.min(...channels.map((a) => LIMITS[a.provider] ?? 63206), 63206);
  const platforms = [...new Set(channels.map((a) => a.provider).filter((p): p is PostProvider => p !== "canva"))];
  // In der Vorschau gibt es kein Canva-Konto; KI-Design läuft dort lokal
  const canvaReady = !!status.data?.canva || DEMO;

  const remember = (saved: SocialPost) => {
    postRef.current = saved;
    setPost(saved);
    mutate<SocialPost[]>(url, (list) => [saved, ...list.filter((p) => p.id !== saved.id)]);
  };

  /** Autosave: neuer Post wird beim ersten Inhalt als Entwurf angelegt */
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (locked) return;
    const empty = !caption.trim() && !media.length;
    if (!postRef.current && empty) return;
    const timer = setTimeout(async () => {
      setSaving("saving");
      const current = postRef.current;
      const body = { workspace_id: workspace.id, caption, media, account_ids: selected, scheduled_at: scheduledAt };
      try {
        const saved = current
          ? await api<SocialPost>(`/api/marketing/posts/${current.id}`, {
              method: "PATCH",
              // Ein geplanter Post ohne Kanal oder Termin geht zurück in den Entwurf
              body: JSON.stringify({ ...body, ...(current.status === "scheduled" && (!selected.length || !scheduledAt) ? { status: "draft" } : {}) }),
            })
          : await api<SocialPost>("/api/marketing/posts", { method: "POST", body: JSON.stringify(body) });
        remember(saved);
        setSaving("saved");
      } catch (error) {
        setSaving("error");
        toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei inhaltlichen Änderungen speichern
  }, [caption, media, selected, scheduledAt]);

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
        const stored = await api<MediaItem>("/api/marketing/media", { method: "POST", body: form });
        setMedia((list) => [...list, stored]);
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Hochladen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  /** Planen, aus dem Plan nehmen oder sofort posten */
  async function act(action: "schedule" | "unschedule" | "now") {
    if (action !== "unschedule" && !selected.length) return toast("Mindestens einen Kanal wählen", "error");
    if (action === "schedule" && !scheduledAt) return toast("Datum wählen", "error");
    if (action === "schedule" && new Date(scheduledAt!).getTime() < Date.now()) return toast("Der Termin liegt in der Vergangenheit", "error");
    setBusy(action);
    const body = {
      workspace_id: workspace.id,
      caption,
      media,
      account_ids: selected,
      scheduled_at: scheduledAt,
      status: action === "schedule" ? "scheduled" : "draft",
    };
    try {
      let saved = post
        ? await api<SocialPost>(`/api/marketing/posts/${post.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<SocialPost>("/api/marketing/posts", { method: "POST", body: JSON.stringify(body) });
      if (action === "now") saved = await api<SocialPost>(`/api/marketing/posts/${saved.id}/publish`, { method: "POST" });
      remember(saved);
      revalidate(URL_WORKSPACES);
      toast(
        action === "now"
          ? POST_STATUS[saved.status].label
          : action === "schedule"
            ? `Geplant: ${new Date(saved.scheduled_at!).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
            : "Wieder Entwurf"
      );
      if (action !== "unschedule") onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function retry() {
    if (!post) return;
    setBusy("now");
    try {
      remember(await api<SocialPost>(`/api/marketing/posts/${post.id}/publish`, { method: "POST" }));
      revalidate(URL_WORKSPACES);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!post) return onClose();
    setBusy("delete");
    try {
      await api(`/api/marketing/posts/${post.id}`, { method: "DELETE" });
      mutate<SocialPost[]>(url, (list) => list.filter((p) => p.id !== post.id));
      revalidate(URL_WORKSPACES);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
      setBusy(null);
    }
  }

  const previewProvider = preview && channels.some((a) => a.provider === preview) ? preview : channels[0]?.provider ?? "instagram";
  const previewAccount = channels.find((a) => a.provider === previewProvider);
  const statusInfo = post ? POST_STATUS[post.status] : null;

  return (
    <Sheet
      open
      onClose={onClose}
      width="max-w-5xl"
      title={post ? (locked ? "Post" : "Post bearbeiten") : "Neuer Post"}
      subtitle={
        <span className="flex items-center gap-2">
          {statusInfo && <Badge color={statusInfo.color}>{statusInfo.label}</Badge>}
          {post?.format && post.format !== "feed" && <Badge>{POST_FORMATS[post.format].label}</Badge>}
          <span aria-live="polite" className="text-[12px]">
            {saving === "saving" ? "Wird gespeichert …" : saving === "saved" ? "Gespeichert" : saving === "error" ? "Nicht gespeichert" : locked ? "" : "Speichert automatisch"}
          </span>
        </span>
      }
    >
      <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5 p-5">
          {post && !locked && (post.created_by === "tage-agent" || (post.review?.length ?? 0) > 0) && (
            <ReviewPanel
              post={post}
              approving={busy === "schedule"}
              onApprove={() => act("schedule")}
              onRevised={(saved) => {
                remember(saved);
                setCaption(saved.caption);
                setMedia(saved.media);
              }}
            />
          )}
          {/* Textfeld wie bei Hootsuite: KI oben, Emojis und Hashtags im Feld, Medien und Canva darunter */}
          <div>
            <section className={clsx("rounded-2xl border bg-surface transition-colors", locked ? "border-snow/[0.08]" : "border-snow/15 focus-within:border-snow/40")}>
              {!locked && (
                <div className="px-3 pt-2.5">
                  <button
                    type="button"
                    aria-expanded={assist}
                    onClick={() => setAssist((open) => !open)}
                    className={clsx("inline-flex h-8 items-center gap-2 rounded-full px-2.5 text-[13.5px] font-semibold transition-colors", assist ? "bg-snow/[0.08]" : "hover:bg-snow/[0.06]")}
                  >
                    <Sparkles className="h-4 w-4" /> Mit KI verbessern
                  </button>
                </div>
              )}
              <textarea
                ref={textRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                placeholder="Bildunterschrift schreiben und dann für jedes Netzwerk anpassen …"
                aria-label="Text"
                disabled={locked}
                className="block w-full resize-y bg-transparent px-4 py-2.5 text-[14.5px] leading-relaxed outline-none placeholder:text-snow/40"
                autoFocus={!initial}
              />
              <div className="flex items-center gap-1 px-3 pb-2">
                <p className={clsx("text-[11.5px] tabular-nums", caption.length > limit ? "text-error" : "text-snow/45")}>
                  {caption.length.toLocaleString("de-DE")} / {limit.toLocaleString("de-DE")}
                </p>
                <span className="flex-1" />
                <EmojiPicker disabled={locked} onPick={insertAtCursor} />
                <HashtagPicker workspaceId={workspace.id} caption={caption} platforms={platforms} onCaption={setCaption} disabled={locked} />
              </div>
              {!locked && (
                <div className="flex items-center gap-2 border-t border-snow/[0.08] px-3 py-2.5">
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
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy === "upload"}
                    aria-busy={busy === "upload"}
                    aria-label="Bild oder Video hochladen"
                    title="Bild oder Video hochladen"
                    className="grid h-11 w-11 place-items-center rounded-full bg-snow/[0.07] hover:bg-snow/[0.12] disabled:opacity-60"
                  >
                    {busy === "upload" ? <Spinner className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" />}
                  </button>
                  {busy === "upload" && <span className="text-[12.5px] text-snow/55">Wird hochgeladen …</span>}
                  <span className="flex-1" />
                  <CanvaButton ready={canvaReady} connected={!!status.data?.canva} onAi={() => setCanvaAi(true)} onImport={() => setCanva(true)} />
                </div>
              )}
            </section>
            {assist && !locked && (
              <CaptionAssist
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                caption={caption}
                // Ohne gewählten Kanal: für alle Plattformen anbieten
                platforms={platforms.length ? platforms : ["instagram", "facebook", "tiktok", "linkedin"]}
                image={media.find((m) => m.kind === "image")?.path}
                onCaption={setCaption}
                onClose={() => setAssist(false)}
              />
            )}
          </div>

          {media.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-medium text-snow/60">Medien {media.length > 0 && <span className="text-snow/40">· Bild anklicken zum Bearbeiten</span>}</p>
            <div className="flex flex-wrap gap-2">
              {media.map((m) => (
                <div key={m.path} className="relative w-24">
                  {m.canva_design_id && (
                    <span className="pointer-events-none absolute top-1 left-1 z-10 rounded bg-sky/85 px-1 text-[10px] font-medium text-snow">
                      Canva
                    </span>
                  )}
                  {m.kind === "image" && m.url ? (
                    <button type="button" disabled={locked} onClick={() => setEditingImage(m)} aria-label="Bild bearbeiten" className="block rounded-lg disabled:cursor-default">
                      {/* eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage */}
                      <img src={m.url} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    </button>
                  ) : m.kind === "video" && m.url ? (
                    <video src={m.url} className="h-24 w-24 rounded-lg object-cover" muted />
                  ) : (
                    <span className="grid h-24 w-24 place-items-center rounded-lg bg-snow/[0.06] text-[11px] text-snow/55">{m.kind}</span>
                  )}
                  {!locked && (
                    <IconButton label="Entfernen" className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-sky shadow" onClick={() => setMedia((list) => list.filter((x) => x.path !== m.path))}>
                      <X className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                  {!locked && m.canva_design_id && (
                    <CanvaMediaActions
                      item={m}
                      editUrl={canvaUrls[m.canva_design_id]}
                      onRefreshed={(fresh) => setMedia((list) => list.map((x) => (x.path === m.path ? fresh : x)))}
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
          )}

          <section>
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
                        on ? "border-snow bg-snow/[0.1]" : "border-snow/15 text-snow/60 hover:border-snow/35"
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
              <p className="text-[13px] text-snow/55">Noch keine Kanäle verbunden. Der Post bleibt Entwurf, bis ein Kanal da ist.</p>
            )}
          </section>

          {!locked && (
            <section>
              <p className="mb-2 text-xs font-medium text-snow/60">Termin</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Datum" className="h-9 w-auto" />
                <Input type="time" value={clock} onChange={(e) => setClock(e.target.value)} aria-label="Uhrzeit" className="h-9 w-auto" step={900} />
                {date && (
                  <Button size="sm" variant="ghost" onClick={() => setDate("")}>
                    Ohne Termin
                  </Button>
                )}
              </div>
              <p className="mt-1 text-[11.5px] text-snow/45">Geplante Posts gehen zur nächsten vollen Stunde raus (ca. 7–22 Uhr).</p>
            </section>
          )}

          {post && Object.keys(post.results).length > 0 && (
            <section className="grid gap-1 text-[13px]">
              <p className="text-xs font-medium text-snow/60">Ergebnis</p>
              {Object.entries(post.results).map(([id, r]) => {
                const account = accounts.find((a) => a.id === id);
                return (
                  <p key={id} className={r.status === "failed" ? "text-error" : "text-snow/75"}>
                    {account ? PROVIDERS[account.provider].label : "Kanal"}: {r.status === "failed" ? r.error : "veröffentlicht"}{" "}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener" className="underline underline-offset-2">
                        öffnen
                      </a>
                    )}
                  </p>
                );
              })}
            </section>
          )}

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-snow/[0.08] pt-4">
            <Button variant="ghost" className="text-error" icon={<Trash2 className="h-4 w-4" />} loading={busy === "delete"} loadingText="Wird gelöscht …" onClick={remove}>
              {post ? "Löschen" : "Verwerfen"}
            </Button>
            <span className="flex-1" />
            {locked ? (
              post?.status === "partial" && (
                <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === "now"} loadingText="Wird gepostet …" onClick={retry}>
                  Fehlende Kanäle erneut
                </Button>
              )
            ) : (
              <>
                {post?.status === "scheduled" ? (
                  <Button icon={<Undo2 className="h-4 w-4" />} loading={busy === "unschedule"} loadingText="…" disabled={busy !== null} onClick={() => act("unschedule")}>
                    Aus dem Plan nehmen
                  </Button>
                ) : (
                  <Button icon={<CalendarClock className="h-4 w-4" />} loading={busy === "schedule"} loadingText="Wird geplant …" disabled={busy !== null} onClick={() => act("schedule")}>
                    Planen
                  </Button>
                )}
                <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === "now"} loadingText="Wird gepostet …" disabled={busy !== null} onClick={() => act("now")}>
                  Jetzt posten
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Vorschau je Plattform */}
        <aside className="border-snow/[0.08] bg-snow/[0.025] p-5 lg:border-l">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(channels.length ? [...new Set(channels.map((a) => a.provider))] : (["instagram"] as Provider[])).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={previewProvider === p}
                onClick={() => setPreview(p)}
                className={clsx("flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-[12px]", previewProvider === p ? "border-snow" : "border-snow/15 text-snow/60")}
              >
                <ProviderMark provider={p} className="h-6 min-w-6" />
                {PROVIDERS[p].label}
              </button>
            ))}
          </div>
          <Preview provider={previewProvider} name={previewAccount?.name ?? workspace.name} handle={previewAccount?.handle ?? null} workspace={workspace} caption={caption} media={media} />
        </aside>
      </div>

      {canva && <CanvaPicker workspaceId={workspace.id} onClose={() => setCanva(false)} onPicked={(items) => setMedia((list) => [...list, ...items])} />}
      {canvaAi && (
        <CanvaAiDialog
          workspaceId={workspace.id}
          caption={caption}
          defaultFormat={platforms.length && platforms.every((p) => p === "tiktok") ? "story" : "feed"}
          onClose={() => setCanvaAi(false)}
          onCreated={(item, editUrl) => {
            setMedia((list) => [item, ...list]);
            if (editUrl && item.canva_design_id) setCanvaUrls((urls) => ({ ...urls, [item.canva_design_id!]: editUrl }));
          }}
        />
      )}
      {editingImage && (
        <ImageEditor
          image={editingImage}
          workspaceId={workspace.id}
          onClose={() => setEditingImage(null)}
          onSaved={(edited) => setMedia((list) => list.map((x) => (x.path === editingImage.path ? edited : x)))}
        />
      )}
      {busy === "now" && (
        <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center">
          <Spinner />
        </div>
      )}
    </Sheet>
  );
}

/** Ungefähre Darstellung, wie der Post auf der Plattform aussieht */
function Preview({ provider, name, handle, workspace, caption, media }: { provider: Provider; name: string; handle: string | null; workspace: WorkspaceSummary; caption: string; media: MediaItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const first = media[0];
  const ratio = provider === "tiktok" ? "9 / 16" : provider === "instagram" ? "4 / 5" : undefined;
  const short = caption.length > 125 && !expanded;
  return (
    <div className="overflow-hidden rounded-2xl border border-snow/[0.08] bg-canvas text-[13px] shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <WorkspaceLogo workspace={workspace} size={30} box />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{handle?.replace(/^@/, "") ?? name}</p>
          {provider === "linkedin" && <p className="text-[11px] text-snow/50">Unternehmensseite · Jetzt</p>}
        </div>
      </div>
      {provider !== "instagram" && provider !== "tiktok" && caption && (
        <p className="px-3 pb-2 whitespace-pre-wrap">{short ? `${caption.slice(0, 125)}… ` : caption}{short && <button type="button" className="text-snow/50" onClick={() => setExpanded(true)}>mehr</button>}</p>
      )}
      {first?.url ? (
        first.kind === "video" ? (
          <video src={first.url} className="w-full bg-black object-cover" style={{ aspectRatio: ratio }} muted controls />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage
          <img src={first.url} alt="" className="w-full object-cover" style={{ aspectRatio: ratio }} />
        )
      ) : (
        <div className="grid place-items-center bg-snow/[0.05] text-[12px] text-snow/45" style={{ aspectRatio: ratio ?? "16 / 9" }}>
          {provider === "instagram" || provider === "tiktok" ? "Bild oder Video nötig" : "Ohne Bild"}
        </div>
      )}
      {media.length > 1 && <p className="px-3 pt-1.5 text-[11px] text-snow/50">+ {media.length - 1} weitere</p>}
      {(provider === "instagram" || provider === "tiktok") && caption && (
        <p className="px-3 py-2 whitespace-pre-wrap">
          <span className="font-semibold">{handle?.replace(/^@/, "") ?? name}</span> {short ? `${caption.slice(0, 125)}… ` : caption}
          {short && (
            <button type="button" className="text-snow/50" onClick={() => setExpanded(true)}>
              mehr
            </button>
          )}
        </p>
      )}
    </div>
  );
}
