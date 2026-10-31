"use client";

import { useState } from "react";
import { ExternalLink, MessageSquareReply, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn as clsx } from "@/lib/cn";
import { revalidate, useResource } from "@/lib/data";
import { COMMENT_STATUS, type CommentStatus, type SocialAccount, type SocialComment } from "@/lib/marketing";
import { Badge, Button, Dialog, Empty, Input, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { Switch } from "@/components/sales/jourfix";
import { ProviderMark } from "./common";
import { URL_WORKSPACES, useCurrentWorkspace, WorkspaceSwitcher } from "./workspace";

// Marketing → Community: Kommentare unter den LinkedIn-Posts der Kundenwelt.
// Mit Autopilot antwortet der Agent selbst (Cron, stündlich); Heikles landet
// unter „Fürs Team“. Außerdem: als Seite oder Person fremde Posts kommentieren.

const FILTERS: { id: "open" | CommentStatus | "all"; label: string }[] = [
  { id: "open", label: "Offen & fürs Team" },
  { id: "replied", label: "Beantwortet" },
  { id: "skipped", label: "Ohne Antwort" },
  { id: "all", label: "Alle" },
];

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const postLink = (urn: string) => `https://www.linkedin.com/feed/update/${urn}`;

export function Community() {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const url = workspace ? `/api/marketing/comments?workspace=${workspace.id}` : null;
  const comments = useResource<SocialComment[]>(url);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [replying, setReplying] = useState<SocialComment | null>(null);
  const [commenting, setCommenting] = useState(false);

  if (!workspace) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const linkedin = workspace.accounts.filter((a) => a.provider === "linkedin");
  const pages = linkedin.filter((a) => a.kind === "organization");
  const accountName = (id: string) => linkedin.find((a) => a.id === id)?.name ?? "";
  const list = (comments.data ?? []).filter((c) =>
    filter === "all" ? c.status !== "old" : filter === "open" ? ["new", "needs_human", "failed"].includes(c.status) : c.status === filter
  );

  async function sync() {
    setBusy("sync");
    try {
      const result = await api<{ synced: { account: string; added?: number; error?: string }[]; replied: unknown[] }>("/api/marketing/comments/sync", {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspace!.id }),
      });
      const failed = result.synced.find((s) => s.error);
      if (failed) toast(`${failed.account}: ${failed.error}`, "error");
      else toast(`${result.synced.reduce((n, s) => n + (s.added ?? 0), 0)} neue Kommentare, ${result.replied.length} bearbeitet`);
      if (url) revalidate(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Abrufen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function toggleAutopilot(account: SocialAccount, value: boolean) {
    setBusy(account.id);
    try {
      await api(`/api/marketing/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify({ auto_reply: value }) });
      revalidate(URL_WORKSPACES);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function setStatus(comment: SocialComment, status: "skipped" | "new") {
    setBusy(comment.id);
    try {
      await api(`/api/marketing/comments/${comment.id}`, { method: "POST", body: JSON.stringify({ status }) });
      if (url) revalidate(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehler", "error");
    }
    setBusy(null);
  }

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Community" meta={workspace.name}>
        <WorkspaceSwitcher />
        <Button size="sm" variant="ghost" className="h-9" icon={<MessageSquareReply className="h-4 w-4" />} disabled={!linkedin.length} onClick={() => setCommenting(true)}>
          Post kommentieren
        </Button>
        <Button size="sm" className="h-9" icon={<RefreshCw className="h-4 w-4" />} loading={busy === "sync"} loadingText="Wird abgerufen …" disabled={!pages.length} onClick={sync}>
          Jetzt abrufen
        </Button>
      </PageBar>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {!linkedin.length ? (
          <Empty title="Kein LinkedIn verbunden" text="Unter Kanäle → LinkedIn → Selbst verbinden. Dabei werden das persönliche Profil und alle Seiten verbunden, auf denen das Konto Admin ist." />
        ) : (
          <>
            <ul className="flex max-w-5xl flex-wrap gap-3 px-4 pt-4 md:px-6">
              {linkedin.map((account) => (
                <li key={account.id} className="flex min-w-64 flex-1 items-center gap-3 rounded-2xl border border-snow/[0.08] bg-panel px-4 py-3">
                  <ProviderMark provider="linkedin" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{account.name}</p>
                    <p className="text-[12px] text-snow/55">{account.kind === "organization" ? "Unternehmensseite" : "Profil: posten und kommentieren, Kommentare gibt LinkedIn nicht heraus"}</p>
                  </div>
                  {account.kind === "organization" && (
                    <Switch
                      label={busy === account.id ? "…" : "Autopilot"}
                      checked={account.auto_reply !== false}
                      onChange={(value) => toggleAutopilot(account, value)}
                      className="text-[13px] text-snow/75"
                    />
                  )}
                </li>
              ))}
            </ul>

            <div className="flex gap-1.5 px-4 pt-5 pb-2 md:px-6" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={clsx("h-8 rounded-full px-3 text-[13px] transition-colors", filter === f.id ? "bg-snow text-sky" : "bg-snow/[0.06] text-snow/70 hover:bg-snow/[0.12]")}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {comments.loading && !comments.data ? (
              <div className="grid place-items-center py-16">
                <Spinner />
              </div>
            ) : !list.length ? (
              <Empty title="Keine Kommentare" text={pages.length ? "Der Abruf läuft stündlich. „Jetzt abrufen“ holt sofort." : "Kommentare gibt es nur für Unternehmensseiten."} />
            ) : (
              <ul className="border-t border-snow/[0.06]">
                {list.map((c) => (
                  <li key={c.id} className="border-b border-snow/[0.06] px-4 py-3.5 md:px-6">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-snow/55">
                      <Badge color={COMMENT_STATUS[c.status].color}>{COMMENT_STATUS[c.status].label}</Badge>
                      <span>{accountName(c.account_id)}</span>
                      <span>{when(c.commented_at)}</span>
                      {c.parent_urn && <span>Antwort im Gespräch</span>}
                      <a href={postLink(c.post_urn)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-snow">
                        Post <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {c.post_text && <p className="mt-1.5 line-clamp-1 text-[12.5px] text-snow/45">Post: {c.post_text}</p>}
                    <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap">{c.text}</p>
                    {c.reply_text && (
                      <p className="mt-2 rounded-xl bg-snow/[0.05] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-snow/80">
                        <span className="text-snow/50">{c.status === "replied" ? (c.replied_by === "agent" ? "Agent" : c.replied_by) : "Vorschlag"}: </span>
                        {c.reply_text}
                      </p>
                    )}
                    {(c.reason || c.error) && <p className={clsx("mt-1.5 text-[12.5px]", c.error ? "text-error" : "text-snow/55")}>{c.error ?? c.reason}</p>}
                    {c.status !== "replied" && (
                      <div className="mt-2.5 flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => setReplying(c)}>
                          Antworten
                        </Button>
                        {c.status === "skipped" ? (
                          <Button size="sm" variant="ghost" loading={busy === c.id} onClick={() => setStatus(c, "new")}>
                            Wieder öffnen
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" loading={busy === c.id} onClick={() => setStatus(c, "skipped")}>
                            Ohne Antwort erledigen
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <ReplyDialog comment={replying} onClose={() => setReplying(null)} onDone={() => url && revalidate(url)} />
      <CommentDialog open={commenting} accounts={linkedin} onClose={() => setCommenting(false)} />
    </div>
  );
}

function ReplyDialog({ comment, onClose, onDone }: { comment: SocialComment | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if (comment && forId !== comment.id) {
    setForId(comment.id);
    setText(comment.reply_text ?? "");
  }

  async function draft() {
    setBusy("draft");
    try {
      const result = await api<{ text: string; reason: string }>(`/api/marketing/comments/${comment!.id}`, { method: "POST", body: JSON.stringify({ draft: true }) });
      setText(result.text);
      if (!result.text) toast(result.reason);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Kein Vorschlag", "error");
    }
    setBusy(null);
  }

  async function send() {
    setBusy("send");
    try {
      await api(`/api/marketing/comments/${comment!.id}`, { method: "POST", body: JSON.stringify({ text }) });
      toast("Antwort veröffentlicht");
      onDone();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Antworten fehlgeschlagen", "error");
      onDone();
    }
    setBusy(null);
  }

  return (
    <Dialog
      open={!!comment}
      onClose={onClose}
      title="Auf Kommentar antworten"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" icon={<Sparkles className="h-4 w-4" />} loading={busy === "draft"} loadingText="Schreibt …" disabled={busy !== null} onClick={draft}>
            Vorschlag von Claude
          </Button>
          <Button variant="primary" loading={busy === "send"} loadingText="Wird gesendet …" disabled={!text.trim() || busy !== null} onClick={send}>
            Antworten
          </Button>
        </>
      }
    >
      <p className="mb-3 rounded-xl bg-snow/[0.04] px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap">{comment?.text}</p>
      <Textarea aria-label="Antwort" value={text} onChange={(e) => setText(e.target.value)} maxLength={1250} rows={5} placeholder="Antwort als Unternehmensseite" />
    </Dialog>
  );
}

function CommentDialog({ open, accounts, onClose }: { open: boolean; accounts: SocialAccount[]; onClose: () => void }) {
  const toast = useToast();
  const [accountId, setAccountId] = useState("");
  const [post, setPost] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = accountId || accounts[0]?.id || "";

  async function send() {
    setBusy(true);
    try {
      await api("/api/marketing/linkedin/comment", { method: "POST", body: JSON.stringify({ account_id: selected, post, text }) });
      toast("Kommentar veröffentlicht");
      setPost("");
      setText("");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Kommentieren fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="LinkedIn-Post kommentieren"
      width="max-w-xl"
      footer={
        <Button variant="primary" loading={busy} loadingText="Wird gesendet …" disabled={!selected || !post.trim() || !text.trim()} onClick={send}>
          Kommentieren
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kommentieren als">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={selected === a.id}
              onClick={() => setAccountId(a.id)}
              className={clsx("h-8 rounded-full px-3 text-[13px]", selected === a.id ? "bg-snow text-sky" : "bg-snow/[0.06] text-snow/70 hover:bg-snow/[0.12]")}
            >
              {a.name}
            </button>
          ))}
        </div>
        <Input aria-label="Post-Adresse" value={post} onChange={(e) => setPost(e.target.value)} placeholder="https://www.linkedin.com/posts/… oder …/feed/update/urn:li:activity:…" />
        <Textarea aria-label="Kommentar" value={text} onChange={(e) => setText(e.target.value)} maxLength={1250} rows={5} placeholder="Kommentar" />
      </div>
    </Dialog>
  );
}
