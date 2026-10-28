"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Forward, Paperclip, Reply, ReplyAll, UserPlus } from "lucide-react";
import { graph, useAsync, type Attachment, type Message } from "@/lib/graph";
import type { InboundMessage } from "@/lib/sales/types";
import { Avatar, Button, IconButton, Spinner, useToast } from "@/components/ui";
import { NewLeadDialog } from "../lead-sheet";
import { formatSize, fullTime, recipientList, recipientName } from "./format";
import { ClassificationChip } from "./message-list";

export type ReplyMode = "reply" | "replyAll" | "forward";

export function ReadingPane({
  message,
  inbound,
  onReply,
  onBack,
}: {
  message: Message;
  inbound?: InboundMessage;
  onReply: (mode: ReplyMode) => void;
  onBack: () => void;
}) {
  const { data: full, error } = useAsync(`message:${message.id}`, () => graph.message(message.id));
  const [leadOpen, setLeadOpen] = useState(false);
  const sender = message.from?.emailAddress;

  return (
    <article className="flex h-full flex-col overflow-y-auto">
      <div className="px-4 pt-3 md:px-6 md:pt-5">
        <IconButton label="Zurück zur Liste" onClick={onBack} className="mb-2 md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <h1 className="min-w-0 flex-1 text-xl leading-snug font-medium break-words">{message.subject || "(Kein Betreff)"}</h1>
          <ClassificationChip inbound={inbound} />
        </div>

        <div className="mt-4 flex items-start gap-3">
          <Avatar name={recipientName(message.from)} className="h-10 w-10 text-sm" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="text-[14px]">
              <span className="font-medium">{recipientName(message.from)}</span>
              {sender?.address && <span className="text-snow/50"> &lt;{sender.address}&gt;</span>}
            </p>
            {message.toRecipients.length > 0 && (
              <p className="mt-0.5 text-snow/55">An: {recipientList(message.toRecipients)}</p>
            )}
            {message.ccRecipients.length > 0 && (
              <p className="mt-0.5 text-snow/55">Cc: {recipientList(message.ccRecipients)}</p>
            )}
          </div>
          <time className="shrink-0 pt-0.5 text-[12px] text-snow/50" dateTime={message.receivedDateTime}>
            {fullTime(message.receivedDateTime)}
          </time>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button size="sm" icon={<Reply className="h-4 w-4" />} onClick={() => onReply("reply")}>
            Antworten
          </Button>
          <Button size="sm" icon={<ReplyAll className="h-4 w-4" />} onClick={() => onReply("replyAll")}>
            Allen antworten
          </Button>
          <Button size="sm" icon={<Forward className="h-4 w-4" />} onClick={() => onReply("forward")}>
            Weiterleiten
          </Button>
          <span className="flex-1" />
          {inbound?.lead_id ? (
            <Link
              href="/sales"
              className="inline-flex h-8 items-center gap-2 rounded-full border border-success/30 px-3 text-[13px] font-medium text-success hover:bg-success/10"
            >
              Lead in der Pipeline
            </Link>
          ) : (
            <Button size="sm" variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setLeadOpen(true)}>
              Als Lead anlegen
            </Button>
          )}
        </div>

        {message.hasAttachments && <Attachments messageId={message.id} />}
      </div>

      <div className="flex-1 px-2 pt-4 pb-6 md:px-6">
        {error ? (
          <p className="px-2 text-sm text-error">Inhalt konnte nicht geladen werden.</p>
        ) : full?.body ? (
          <MailBody body={full.body} />
        ) : (
          <div className="grid h-32 place-items-center">
            <Spinner />
          </div>
        )}
      </div>

      <NewLeadDialog
        open={leadOpen}
        onClose={() => setLeadOpen(false)}
        initial={{
          name: sender?.name || sender?.address || "",
          email: sender?.address ?? null,
          source: "email",
          source_ref: message.internetMessageId,
          message: full?.body ? textOf(full.body) : message.bodyPreview,
        }}
      />
    </article>
  );
}

/** Text einer Mail für die Lead-Notiz (HTML ohne Tags, gekürzt). */
function textOf(body: NonNullable<Message["body"]>) {
  if (body.contentType === "text") return body.content.slice(0, 4000);
  const doc = new DOMParser().parseFromString(body.content, "text/html");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Mail-HTML in einer Sandbox ohne Skripte, auf weißem Papier wie Outlook.
 * allow-same-origin nur, um die Höhe zu messen; Skripte bleiben gesperrt. */
function MailBody({ body }: { body: NonNullable<Message["body"]> }) {
  const [height, setHeight] = useState(200);
  const content =
    body.contentType === "html"
      ? body.content
      : `<div style="white-space:pre-wrap">${escapeHtml(body.content)}</div>`;
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    html{color-scheme:light}
    body{margin:0;padding:20px 22px;background:#fff;color:#1f1d1b;font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}
    img{max-width:100%;height:auto}
    table{max-width:100%}
    a{color:#0f6cbd}
    blockquote{margin:0 0 0 4px;padding-left:12px;border-left:2px solid #d0ccd2;color:#5c5853}
  </style></head><body>${content}</body></html>`;

  const measure = useCallback((frame: HTMLIFrameElement | null) => {
    const doc = frame?.contentDocument;
    if (!doc) return;
    const update = () => setHeight(Math.max(120, doc.documentElement.scrollHeight));
    update();
    doc.querySelectorAll("img").forEach((img) => img.addEventListener("load", update));
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-snow/10 bg-white shadow-[0_8px_30px_var(--shadow-color)]">
      <iframe
        title="Nachricht"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        onLoad={(event) => measure(event.currentTarget)}
        style={{ height }}
        className="block w-full border-0"
      />
    </div>
  );
}

function Attachments({ messageId }: { messageId: string }) {
  const { data } = useAsync(`attachments:${messageId}`, () => graph.attachments(messageId));
  const files = data?.filter((a) => !a.isInline) ?? [];
  if (!files.length) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {files.map((file) => (
        <AttachmentChip key={file.id} messageId={messageId} file={file} />
      ))}
    </ul>
  );
}

function AttachmentChip({ messageId, file }: { messageId: string; file: Attachment }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function download() {
    setBusy(true);
    try {
      const blob = await graph.download(messageId, file.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast("Download fehlgeschlagen", "error");
    }
    setBusy(false);
  }
  return (
    <li>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy || undefined}
        className="flex max-w-72 items-center gap-2.5 rounded-xl border border-snow/12 bg-surface px-3 py-2 text-left hover:border-snow/25 disabled:cursor-progress"
      >
        {busy ? <Spinner className="h-4 w-4" /> : <Paperclip className="h-4 w-4 shrink-0 text-snow/55" />}
        <span className="min-w-0">
          <span className="block truncate text-[13px]">{file.name}</span>
          <span className="block text-[11px] text-snow/45">{busy ? "Wird geladen …" : formatSize(file.size)}</span>
        </span>
        <Download className="h-4 w-4 shrink-0 text-snow/40" />
      </button>
    </li>
  );
}
