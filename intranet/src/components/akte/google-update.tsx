"use client";

import { useRef, useState } from "react";
import { History, RefreshCw, Save, Send, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { load, mutate, useResource } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { graphErrorMessage, graphFor } from "@/lib/graph";
import type { GoogleUpdateRow, GoogleUpdateSettings } from "@/lib/google";
import { Button, Dialog, Empty, Field, Input, Spinner, useToast } from "@/components/ui";
import { RichEditor, type RichEditorHandle } from "@/components/rich-editor";
import { useMe } from "@/components/access";
import { ToneBadge } from "@/components/google/overview";

// Wochen-Update an den Kunden: Vorschlag aus dem Google-Stand der Akte im
// Stil der bisherigen Mails, bearbeitbar, als Outlook-Entwurf speichern oder
// direkt senden (im Browser über Graph aus dem eingestellten Postfach).
// Montags legt der Cron den Entwurf automatisch an (auto_draft).

type UpdateView = { settings: GoogleUpdateSettings; history: GoogleUpdateRow[]; subject: string; html: string };

const split = (value: string) => value.split(/[,;\s]+/).map((v) => v.trim()).filter(Boolean);

export function WeeklyUpdate({ workspaceId }: { workspaceId: string }) {
  const key = `/api/marketing/workspaces/${workspaceId}/google/update`;
  const view = useResource<UpdateView>(key);
  const [version, setVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  if (view.error) return <Empty title="Wochen-Update konnte nicht geladen werden" text={view.error.message} />;
  if (!view.data) {
    return (
      <div className="grid h-40 place-items-center">
        <Spinner />
      </div>
    );
  }
  const data = view.data;

  async function regenerate() {
    setRefreshing(true);
    await load(key, true);
    setVersion((v) => v + 1);
    setRefreshing(false);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Composer key={`${version}-${data.subject}`} url={key} data={data} onRegenerate={regenerate} refreshing={refreshing} />
      <div className="grid content-start gap-5">
        <SettingsCard key={JSON.stringify(data.settings)} url={key} settings={data.settings} onSaved={() => setVersion((v) => v + 1)} />
        <HistoryCard history={data.history} />
      </div>
    </div>
  );
}

function Composer({ url, data, onRegenerate, refreshing }: { url: string; data: UpdateView; onRegenerate: () => void; refreshing: boolean }) {
  const toast = useToast();
  const me = useMe();
  const editor = useRef<RichEditorHandle>(null);
  const [subject, setSubject] = useState(data.subject);
  const [busy, setBusy] = useState<"draft" | "send" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const mailbox = data.settings.mailbox || me.data?.email || "";
  const { to, cc } = data.settings;

  async function log(status: "draft" | "sent", html: string) {
    const history = await api<GoogleUpdateRow[]>(url, { method: "POST", body: JSON.stringify({ status, subject, to, cc, html, mailbox }) });
    mutate<UpdateView>(url, (v) => ({ ...v, history }));
  }

  async function saveDraft() {
    const html = editor.current?.html() ?? data.html;
    setBusy("draft");
    try {
      await graphFor(mailbox).saveDraft({ to, cc, subject, body: html, html: true });
      await log("draft", html);
      toast(`Entwurf in ${mailbox} gespeichert`);
    } catch (error) {
      toast(graphErrorMessage(error), "error");
    }
    setBusy(null);
  }

  async function send() {
    const html = editor.current?.html() ?? data.html;
    setBusy("send");
    try {
      await graphFor(mailbox).send({ to, cc, subject, body: html, html: true });
      await log("sent", html);
      toast(`Update an ${to.join(", ")} gesendet`);
      setConfirm(false);
    } catch (error) {
      toast(graphErrorMessage(error), "error");
    }
    setBusy(null);
  }

  const ready = !!mailbox && to.length > 0 && !!subject.trim();

  return (
    <section className="min-w-0 rounded-2xl border border-snow/[0.08] bg-surface p-4 shadow-[0_2px_10px_var(--shadow-color)] md:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[15px] font-medium">Update dieser Woche</h2>
        <Button size="sm" variant="ghost" icon={<RefreshCw className="h-4 w-4" />} loading={refreshing} loadingText="Wird erzeugt …" onClick={onRegenerate}>
          Neu aus Stand erzeugen
        </Button>
      </div>
      <dl className="mb-3 grid gap-1 text-[13px]">
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-snow/50">Von</dt>
          <dd className="min-w-0 truncate">{mailbox || <span className="text-error">Postfach fehlt</span>}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-12 shrink-0 text-snow/50">An</dt>
          <dd className="min-w-0 break-words">{to.length ? to.join(", ") : <span className="text-error">Empfänger fehlen (rechts eintragen)</span>}</dd>
        </div>
        {cc.length > 0 && (
          <div className="flex gap-2">
            <dt className="w-12 shrink-0 text-snow/50">Cc</dt>
            <dd className="min-w-0 break-words">{cc.join(", ")}</dd>
          </div>
        )}
      </dl>
      <Field label="Betreff">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
      <p className="mt-3 mb-1.5 text-xs font-medium text-snow/60">Text</p>
      <RichEditor ref={editor} initialHtml={data.html} className="min-h-[360px]" />
      <p className="mt-2 text-[12px] text-snow/45">Aus den sichtbaren To-dos der Akte. Interne Notizen und ausgeblendete Punkte stehen nicht drin. Deine Outlook-Signatur hängt Outlook beim Senden aus Outlook an, nicht beim Senden von hier.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button icon={<Save className="h-4 w-4" />} loading={busy === "draft"} loadingText="Wird gespeichert …" disabled={!ready || busy !== null} onClick={saveDraft}>
          Als Entwurf in Outlook speichern
        </Button>
        <Button variant="primary" icon={<Send className="h-4 w-4" />} disabled={!ready || busy !== null} onClick={() => setConfirm(true)}>
          Senden
        </Button>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Update jetzt senden?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={busy === "send"} loadingText="Wird gesendet …" onClick={send}>
              Jetzt senden
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-snow/75">
          „{subject}“ geht von <b>{mailbox}</b> an <b>{to.join(", ")}</b>
          {cc.length ? (
            <>
              {" "}
              (Cc {cc.join(", ")})
            </>
          ) : null}
          .
        </p>
      </Dialog>
    </section>
  );
}

function SettingsCard({ url, settings, onSaved }: { url: string; settings: GoogleUpdateSettings; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ to: settings.to.join(", "), cc: settings.cc.join(", "), greeting: settings.greeting, mailbox: settings.mailbox, auto_draft: settings.auto_draft, reviews: settings.reviews });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const next = await api<UpdateView>(url, { method: "PUT", body: JSON.stringify({ ...form, to: split(form.to), cc: split(form.cc) }) });
      mutate<UpdateView>(url, () => next);
      toast("Einstellungen gespeichert");
      onSaved();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-2xl border border-snow/[0.08] bg-surface p-4 shadow-[0_2px_10px_var(--shadow-color)]">
      <h2 className="flex items-center gap-2 text-[15px] font-medium">
        <Settings2 className="h-4 w-4 text-snow/55" /> Empfänger & Ablauf
      </h2>
      <Field label="An">{(id) => <Input id={id} value={form.to} onChange={(e) => set("to", e.target.value)} placeholder="name@kunde.de, …" />}</Field>
      <Field label="Cc">{(id) => <Input id={id} value={form.cc} onChange={(e) => set("cc", e.target.value)} />}</Field>
      <Field label="Anrede">{(id) => <Input id={id} value={form.greeting} onChange={(e) => set("greeting", e.target.value)} placeholder="Hallo Sabrina, hallo Kathrin," />}</Field>
      <Field label="Von (Postfach)" hint="Entwurf und Versand laufen über dieses Postfach.">
        {(id) => <Input id={id} type="email" value={form.mailbox} onChange={(e) => set("mailbox", e.target.value)} placeholder="name@grid-agency.de" />}
      </Field>
      <label className="flex items-start gap-2 text-[13.5px]">
        <input type="checkbox" checked={form.auto_draft} onChange={(e) => set("auto_draft", e.target.checked)} className="mt-0.5 h-4 w-4 accent-current" />
        <span>
          Montags automatisch als Entwurf in Outlook
          <span className="block text-[12px] text-snow/45">Gegen 6:30 Uhr, gesendet wird nichts.</span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-[13.5px]">
        <input type="checkbox" checked={form.reviews} onChange={(e) => set("reviews", e.target.checked)} className="mt-0.5 h-4 w-4 accent-current" />
        <span>
          Abschnitt „Bewertungen“
          <span className="block text-[12px] text-snow/45">Sterne und Anzahl je Standort, soweit eingetragen.</span>
        </span>
      </label>
      <Button type="submit" size="sm" loading={busy} loadingText="Wird gespeichert …" className="justify-self-end">
        Speichern
      </Button>
    </form>
  );
}

function HistoryCard({ history }: { history: GoogleUpdateRow[] }) {
  return (
    <section className="rounded-2xl border border-snow/[0.08] bg-surface p-4 shadow-[0_2px_10px_var(--shadow-color)]">
      <h2 className="mb-2 flex items-center gap-2 text-[15px] font-medium">
        <History className="h-4 w-4 text-snow/55" /> Verlauf
      </h2>
      {history.length ? (
        <ul className="grid gap-2">
          {history.slice(0, 8).map((row) => (
            <li key={row.id} className="text-[13px]">
              <div className="flex items-center gap-2">
                <ToneBadge tone={row.status === "sent" ? "success" : "neutral"}>{row.status === "sent" ? "Gesendet" : "Entwurf"}</ToneBadge>
                <span className="text-snow/50 tabular-nums">{formatDateTime(row.sent_at ?? row.created_at)}</span>
              </div>
              <p className="mt-0.5 truncate">{row.subject}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-snow/50">Noch kein Update aus dem Intranet.</p>
      )}
    </section>
  );
}
