"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Folder, Link2, Paperclip, UserPlus } from "lucide-react";
import { graphFor, useAsync, type Attachment, type Message } from "@/lib/graph";
import type { InboundMessage } from "@/lib/sales/types";
import { IconButton, Spinner, useToast } from "@/components/ui";
import { formatSize, fullTime, recipientList, recipientName } from "./format";
import { ClassificationChip, MailAvatar } from "./message-list";

export type ReplyMode = "reply" | "replyAll" | "forward";

export function ReadingPane({
  mailbox,
  message,
  inbound,
  folderLabel,
  mailboxName,
  onLead,
  onBack,
}: {
  mailbox: string;
  message: Message;
  inbound?: InboundMessage;
  /** Ordner, in dem die Mail liegt (Chip unter dem Kopf) */
  folderLabel: string;
  mailboxName: string;
  onLead: () => void;
  onBack: () => void;
}) {
  const { data: full, error } = useAsync(`message:${mailbox}:${message.id}`, () => graphFor(mailbox).message(message.id));
  const sender = message.from?.emailAddress;
  const linked = inbound?.lead_id || inbound?.application_id || inbound?.invoice_id;
  const chip = "inline-flex h-9 items-center gap-1.5 rounded-full bg-snow/[0.07] px-3.5 text-[13px] font-medium text-snow/80 transition-colors hover:bg-snow/[0.12] hover:text-snow";

  return (
    <article className="flex h-full flex-col overflow-y-auto">
      <header className="border-b border-snow/[0.06] bg-sky/50 px-4 pt-4 pb-4 md:px-8 md:pt-6">
        <IconButton label="Zurück zur Liste" onClick={onBack} className="mb-2 md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <h1 className="text-[22px] leading-snug font-semibold tracking-tight break-words text-snow/90 md:text-[26px]">{message.subject || "(Kein Betreff)"}</h1>

        <div className="mt-4 flex items-start gap-3">
          <MailAvatar name={recipientName(message.from)} size={46} />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="truncate text-[15px] font-semibold">{recipientName(message.from)}</p>
            {sender?.address && <p className="truncate text-snow/55">&lt;{sender.address}&gt;</p>}
            {message.toRecipients.length > 0 && <p className="mt-0.5 text-snow/55">An: {recipientList(message.toRecipients)}</p>}
            {message.ccRecipients.length > 0 && <p className="mt-0.5 text-snow/55">Cc: {recipientList(message.ccRecipients)}</p>}
          </div>
          <time className="shrink-0 pt-0.5 text-[12.5px] text-snow/50" dateTime={message.receivedDateTime}>
            {fullTime(message.receivedDateTime)}
          </time>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {linked ? (
            <Link href={inbound!.lead_id ? "/sales" : inbound!.application_id ? "/personal" : "/finance"} className={chip}>
              <Link2 className="h-4 w-4" />
              {inbound!.lead_id ? "Lead in der Pipeline" : inbound!.application_id ? "Bewerbung in Personal" : "Rechnung in Finance"}
            </Link>
          ) : (
            <button type="button" onClick={onLead} className={chip}>
              <UserPlus className="h-4 w-4" /> Als Lead anlegen …
            </button>
          )}
          <span className={chip}>
            <Folder className="h-4 w-4" /> {folderLabel} · {mailboxName}
          </span>
          <ClassificationChip inbound={inbound} />
        </div>

        {message.hasAttachments && <Attachments mailbox={mailbox} messageId={message.id} />}
      </header>

      <div className="flex-1 bg-white">
        {error ? (
          <p className="px-8 py-6 text-sm text-error">Inhalt konnte nicht geladen werden.</p>
        ) : full?.body ? (
          <MailBody body={full.body} flat />
        ) : (
          <div className="grid h-32 place-items-center">
            <Spinner />
          </div>
        )}
      </div>
    </article>
  );
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Mail-HTML in einer Sandbox ohne Skripte, auf weißem Papier wie Outlook.
 * allow-same-origin nur, um die Höhe zu messen; Skripte bleiben gesperrt. */
export function MailBody({ body, flat = false }: { body: NonNullable<Message["body"]>; /** ohne Rahmen, füllt den Lesebereich */ flat?: boolean }) {
  const [height, setHeight] = useState(200);
  const content =
    body.contentType === "html"
      ? body.content
      : `<div style="white-space:pre-wrap">${escapeHtml(body.content)}</div>`;
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    html{color-scheme:light}
    body{margin:0;padding:${flat ? "28px 32px" : "20px 22px"};background:#fff;color:#1f1d1b;font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}
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
    <div className={flat ? "bg-white" : "overflow-hidden rounded-2xl border border-snow/10 bg-white shadow-[0_8px_30px_var(--shadow-color)]"}>
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

export function Attachments({ mailbox, messageId }: { mailbox: string; messageId: string }) {
  const { data } = useAsync(`attachments:${mailbox}:${messageId}`, () => graphFor(mailbox).attachments(messageId));
  const files = data?.filter((a) => !a.isInline) ?? [];
  if (!files.length) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {files.map((file) => (
        <AttachmentChip key={file.id} mailbox={mailbox} messageId={messageId} file={file} />
      ))}
    </ul>
  );
}

function AttachmentChip({ mailbox, messageId, file }: { mailbox: string; messageId: string; file: Attachment }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function download() {
    setBusy(true);
    try {
      const blob = await graphFor(mailbox).download(messageId, file.id);
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
