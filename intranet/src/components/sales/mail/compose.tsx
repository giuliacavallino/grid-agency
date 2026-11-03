"use client";

import { useRef, useState } from "react";
import { CircleAlert, MailCheck, Paperclip, Save, Send, Trash2, Video, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { MAILBOXES } from "@/lib/config";
import { graphFor, type FileAttachment, type Message } from "@/lib/graph";
import { useMe } from "@/components/access";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { Button, Spinner, useToast } from "@/components/ui";
import { formatSize, isEmail, parseAddresses, recipientList, recipientName } from "./format";

export type ComposeState =
  | { mode: "new"; to?: string }
  | { mode: "reply" | "replyAll" | "forward"; source: Message };

const PREFIX = { reply: "AW: ", replyAll: "AW: ", forward: "WG: " } as const;
const MAX_FILES = 20 * 1024 * 1024; // Graph nimmt über sendMail rund 25 MB (Base64)

type FileItem = FileAttachment & { size: number };

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Signatur im Stil der Agentur: Gruß, Name, Firma */
function signatureHtml(name: string, mailbox: string) {
  return `<p style="margin:16px 0 0">Beste Grüße<br><strong>${escape(name)}</strong><br>GRID AGENCY · <a href="https://grid-agency.de">grid-agency.de</a><br><span style="color:#6b665f">${escape(mailbox)}</span></p>`;
}

/** Verfassen wie in Outlook, im eigenen Fenster: neue Mail, Antwort oder
 * Weiterleitung. Antworten hängen die Originalnachricht automatisch an. */
export function Compose({
  state,
  mailbox,
  fromOptions = [],
  onClose,
  onSent,
}: {
  state: ComposeState;
  /** Postfach, aus dem gesendet bzw. geantwortet wird */
  mailbox: string;
  /** Bei neuen Mails wählbare Absender (Postfächer des Bereichs) */
  fromOptions?: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const me = useMe();
  const editor = useRef<RichEditorHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [sender, setSender] = useState(mailbox);
  const own = new Set(MAILBOXES.map((m) => m.address));
  const source = state.mode === "new" ? null : state.source;
  const isNew = state.mode === "new";
  const [to, setTo] = useState(state.mode === "new" ? (state.to ?? "") : "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(source ? `${PREFIX[state.mode as keyof typeof PREFIX]}${source.subject ?? ""}` : "");
  const [important, setImportant] = useState(false);
  const [readReceipt, setReadReceipt] = useState(false);
  const [signature, setSignature] = useState<"standard" | "none">("standard");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [busy, setBusy] = useState<"send" | "draft" | "meet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const from = isNew ? sender : mailbox;
  const name = me.data?.name || from;

  // Bei Antworten stehen Empfänger*innen fest
  const fixedTo =
    state.mode === "reply"
      ? recipientName(state.source.from)
      : state.mode === "replyAll"
        ? recipientList(
            [state.source.from, ...state.source.toRecipients, ...state.source.ccRecipients].filter(
              (r): r is NonNullable<typeof r> => !!r && !own.has(r.emailAddress.address.toLowerCase())
            )
          )
        : null;

  function html() {
    const body = editor.current?.html() ?? "";
    return signature === "standard" ? `${body}${signatureHtml(name, from)}` : body;
  }

  function check(forDraft = false) {
    const toList = parseAddresses(to);
    const ccList = parseAddresses(cc);
    const bccList = parseAddresses(bcc);
    if (fixedTo === null && !forDraft) {
      if (!toList.length) return setError("Bitte mindestens eine Empfängeradresse eintragen."), null;
    }
    const invalid = [...toList, ...ccList, ...bccList].find((a) => !isEmail(a));
    if (invalid) return setError(`„${invalid}“ ist keine gültige E-Mail-Adresse.`), null;
    if (isNew && !forDraft && !editor.current?.text().trim() && !subject.trim()) return setError("Die Nachricht ist leer."), null;
    return { toList, ccList, bccList };
  }

  async function send() {
    setError(null);
    const lists = check();
    if (!lists) return;
    setBusy("send");
    const graph = graphFor(from);
    try {
      if (state.mode === "new") {
        await graph.send(
          { to: lists.toList, cc: lists.ccList, bcc: lists.bccList, subject, body: html(), html: true, important, readReceipt },
          files.map(({ name, contentType, contentBytes }) => ({ name, contentType, contentBytes }))
        );
      } else if (state.mode === "forward") await graph.forward(state.source.id, { to: lists.toList, comment: html() });
      else await graph.reply(state.source.id, { comment: html(), all: state.mode === "replyAll" });
      toast("Gesendet");
      onSent();
    } catch {
      setError(`Senden fehlgeschlagen. Hat dein Konto „Senden als“ für ${from}?`);
      setBusy(null);
    }
  }

  async function saveDraft() {
    setError(null);
    const lists = check(true);
    if (!lists) return;
    setBusy("draft");
    try {
      await graphFor(from).saveDraft(
        { to: lists.toList, cc: lists.ccList, bcc: lists.bccList, subject, body: html(), html: true, important, readReceipt },
        files.map(({ name, contentType, contentBytes }) => ({ name, contentType, contentBytes }))
      );
      toast("Entwurf gespeichert");
      onSent();
    } catch {
      setError("Entwurf konnte nicht gespeichert werden.");
      setBusy(null);
    }
  }

  async function addMeet() {
    setBusy("meet");
    try {
      const room = await api<{ url: string }>("/api/kalender/meet", { method: "POST", body: JSON.stringify({ title: subject || "Meeting" }) });
      editor.current?.insertHtml(`<p>Zum Video-Call: <a href="${room.url}">${room.url}</a></p>`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Meet-Link konnte nicht angelegt werden", "error");
    }
    setBusy(null);
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const added: FileItem[] = [];
    for (const file of Array.from(list)) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      added.push({ name: file.name, contentType: file.type || "application/octet-stream", contentBytes: btoa(binary), size: file.size });
    }
    const next = [...files, ...added];
    if (next.reduce((sum, f) => sum + f.size, 0) > MAX_FILES) return toast("Anhänge zusammen höchstens 20 MB", "error");
    setFiles(next);
  }

  const title = { new: "Neue Mail", reply: "Antworten", replyAll: "Allen antworten", forward: "Weiterleiten" }[state.mode];
  const field = "h-11 w-full rounded-xl border border-snow/10 bg-surface px-3.5 text-[14px] text-snow outline-none placeholder:text-snow/35 focus:border-snow/35";
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:opacity-50",
      on ? "border-snow bg-snow text-sky" : "border-snow/12 bg-surface text-snow/80 hover:border-snow/30"
    );

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-4 md:px-7">
        <h1 className="mb-4 text-[24px] font-semibold tracking-tight">{title}</h1>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={busy !== null}
            aria-busy={busy === "send" || undefined}
            className="hidden w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl bg-snow text-[13px] font-medium text-sky transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex"
          >
            {busy === "send" ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" />}
            {busy === "send" ? "Wird gesendet …" : "Senden"}
          </button>
          <div className="grid min-w-0 flex-1 grid-cols-[64px_1fr] items-center gap-x-2 gap-y-2">
            <label className="text-[13px] text-snow/55" htmlFor="compose-from">
              Von
            </label>
            {isNew && fromOptions.length > 1 ? (
              <select id="compose-from" value={sender} onChange={(e) => setSender(e.target.value)} className={field}>
                {fromOptions.map((address) => (
                  <option key={address} value={address}>
                    {address}
                  </option>
                ))}
              </select>
            ) : (
              <span id="compose-from" className={cn(field, "flex items-center text-snow/70")}>
                {from}
              </span>
            )}

            <label className="text-[13px] text-snow/55" htmlFor="compose-to">
              An
            </label>
            <div className="flex items-center gap-2">
              {fixedTo !== null ? (
                <span id="compose-to" className={cn(field, "flex items-center truncate")}>
                  {fixedTo}
                </span>
              ) : (
                <input
                  id="compose-to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="name@firma.de"
                  className={field}
                  autoFocus={!isNew || !to}
                />
              )}
              {fixedTo === null && !showCc && (
                <button type="button" onClick={() => setShowCc(true)} className="shrink-0 text-[13px] font-medium text-snow/70 underline underline-offset-2 hover:text-snow">
                  Cc/Bcc
                </button>
              )}
            </div>

            {showCc && (
              <>
                <label className="text-[13px] text-snow/55" htmlFor="compose-cc">
                  Cc
                </label>
                <input id="compose-cc" value={cc} onChange={(e) => setCc(e.target.value)} className={field} />
                <label className="text-[13px] text-snow/55" htmlFor="compose-bcc">
                  Bcc
                </label>
                <input id="compose-bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} className={field} />
              </>
            )}

            <label className="text-[13px] text-snow/55" htmlFor="compose-subject">
              Betreff
            </label>
            {isNew ? (
              <input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={field} />
            ) : (
              <span id="compose-subject" className={cn(field, "flex items-center truncate")}>
                {subject}
              </span>
            )}
          </div>
        </div>

        {isNew && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={important} onClick={() => setImportant((v) => !v)} className={chip(important)}>
              <CircleAlert className="h-4 w-4" /> Wichtig
            </button>
            <button type="button" aria-pressed={readReceipt} onClick={() => setReadReceipt((v) => !v)} className={chip(readReceipt)}>
              <MailCheck className="h-4 w-4" /> Lesebestätigung
            </button>
          </div>
        )}

        <select aria-label="Signatur" value={signature} onChange={(e) => setSignature(e.target.value as "standard" | "none")} className={cn(field, "mt-3 h-10")}>
          <option value="standard">Signatur: {name}</option>
          <option value="none">Keine Signatur</option>
        </select>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={addMeet} disabled={busy !== null} aria-busy={busy === "meet" || undefined} className={chip(false)}>
            {busy === "meet" ? <Spinner className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            {busy === "meet" ? "Link wird angelegt …" : "GRID Meet"}
          </button>
          {isNew && (
            <button type="button" onClick={() => fileInput.current?.click()} className={chip(false)}>
              <Paperclip className="h-4 w-4" /> Datei anhängen
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {files.map((file, index) => (
            <span key={`${file.name}-${index}`} className="inline-flex h-9 max-w-64 items-center gap-2 rounded-full bg-snow/[0.07] pr-1.5 pl-3 text-[12.5px]">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-snow/55" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-snow/45">{formatSize(file.size)}</span>
              <button type="button" aria-label={`${file.name} entfernen`} onClick={() => setFiles((list) => list.filter((_, i) => i !== index))} className="grid h-6 w-6 place-items-center rounded-full hover:bg-snow/10">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        <RichEditor ref={editor} placeholder="Text …" className="mt-3 min-h-[320px]" autoFocus={isNew && !!to} />

        {signature === "standard" && (
          <div className="mt-3 px-1 text-[14px] text-snow/70">
            <p>Beste Grüße</p>
            <p className="font-medium text-snow">{name}</p>
            <p className="text-[12.5px] text-snow/50">GRID AGENCY · grid-agency.de · {from}</p>
          </div>
        )}
        {source && <p className="mt-3 px-1 text-[12px] text-snow/45">Die ursprüngliche Nachricht von {recipientName(source.from)} wird angehängt.</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-snow/[0.08] bg-sky px-3 py-3 md:px-6">
        <Button variant="ghost" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={onClose} disabled={busy !== null}>
          Verwerfen
        </Button>
        {isNew && (
          <Button variant="ghost" size="sm" icon={<Save className="h-4 w-4" />} onClick={saveDraft} loading={busy === "draft"} loadingText="Wird gespeichert …" disabled={busy !== null}>
            Entwurf speichern
          </Button>
        )}
        <p role={error ? "alert" : undefined} className="min-w-0 flex-1 truncate text-[12.5px] text-error">
          {error}
        </p>
        <Button type="submit" variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === "send"} loadingText="Wird gesendet …" disabled={busy !== null && busy !== "send"}>
          Senden
        </Button>
      </div>
    </form>
  );
}
