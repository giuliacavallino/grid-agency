"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarClock, CalendarPlus, Download, ExternalLink, Globe, Mail, Paperclip, Search, Video } from "lucide-react";
import { api, apiFetch } from "@/lib/api";
import { mailboxLabel } from "@/lib/config";
import { createRow, deleteRow, mutate, updateRow, useRows } from "@/lib/data";
import { formatDateTime, relativeTime } from "@/lib/format";
import { APPLICATION_STAGES, topPosition, type Application, type ApplicationFile, type ApplicationStage } from "@/lib/sales/types";
import { Board, BoardCard } from "@/components/board";
import { Button, Dialog, Empty, Field, Input, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { formatSize } from "@/components/sales/mail/format";
import { Attachments } from "@/components/sales/mail/reading-pane";
import { PageBar } from "@/components/sales/shell";

/** Bewerbungen als Kanban: Neue Bewerbung (automatisch aus dem Formular der
 * Website und aus den Postfächern) → Gespräch → Case Study → Zusage / Absage. */
export function Applications() {
  const { data: applications, loading, error } = useRows<Application>("applications");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (applications ?? []).filter((a) => !q || [a.name, a.email, a.position_title].some((v) => v?.toLowerCase().includes(q)));
  }, [applications, query]);
  const active = visible.filter((a) => a.stage !== "zusage" && a.stage !== "absage").length;

  async function move(application: Application, stage: string, position: number) {
    try {
      await updateRow<Application>("applications", application.id, { stage: stage as ApplicationStage, position });
    } catch {
      toast("Verschieben fehlgeschlagen", "error");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Bewerbungen" meta={applications && `${active} im Prozess`}>
        <div className="relative min-w-0 flex-1 md:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Bewerbungen durchsuchen" className="h-9 w-full pl-9" />
        </div>
        <Button variant="primary" size="sm" className="h-9" onClick={() => setCreating(true)}>
          Neue Bewerbung
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Bewerbungen konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <Board
          columns={APPLICATION_STAGES}
          items={visible}
          onOpen={setOpenId}
          onMove={move}
          onAdd={() => setCreating(true)}
          addLabel="Bewerbung anlegen"
          renderCard={(application, overlay) => <ApplicationCard application={application} overlay={overlay} />}
        />
      )}

      <ApplicationSheet application={applications?.find((a) => a.id === openId)} open={!!openId} onClose={() => setOpenId(null)} />
      <NewApplicationDialog open={creating} onClose={() => setCreating(false)} onCreated={setOpenId} />
    </div>
  );
}

const interviewTime = (value: string) => {
  const d = new Date(value);
  const day = d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
  return `${day} · ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Einladung zum Vorstellungsgespräch: Mail von hello@ mit Link zur
 * Terminwahl in deinem Outlook-Kalender, Karte wandert nach „Gespräch“. */
function useInvite(a: Application) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function invite() {
    setBusy(true);
    try {
      const result = await api<{ application: Application; link: string | null }>(`/api/personal/applications/${a.id}/invite`, { method: "POST" });
      mutate<Application[]>("/api/sales/applications", (rows) => rows.map((row) => (row.id === a.id ? { ...row, ...result.application } : row)));
      toast(`Einladung an ${a.email} gesendet`);
      if (result.link) console.info("Terminwahl (Vorschau):", result.link);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Einladen fehlgeschlagen", "error");
    }
    setBusy(false);
  }
  return { invite, busy, canInvite: !!a.email && !a.interview_at };
}

/** Ein Klick auf der Karte: lädt ein, ohne die Karte zu öffnen oder zu ziehen. */
function InviteButton({ application }: { application: Application }) {
  const { invite, busy } = useInvite(application);
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();
  return (
    <button
      type="button"
      onPointerDown={stop}
      onKeyDown={stop}
      onClick={(event) => {
        event.stopPropagation();
        invite();
      }}
      disabled={busy}
      aria-busy={busy || undefined}
      className="btn-rainbow mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-full bg-snow px-3 text-[12px] font-medium whitespace-nowrap text-sky active:scale-95 disabled:cursor-progress disabled:opacity-80"
    >
      {busy ? <Spinner className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
      {busy ? "Wird eingeladen …" : "Einladen"}
    </button>
  );
}

function ApplicationCard({ application: a, overlay }: { application: Application; overlay?: boolean }) {
  const late = a.next_step_at && new Date(a.next_step_at) < new Date();
  const open = a.stage !== "zusage" && a.stage !== "absage";
  return (
    <BoardCard overlay={overlay}>
      <p className="truncate text-[14px] font-medium">{a.name}</p>
      {a.position_title && <p className="truncate text-[12px] text-snow/55">{a.position_title}</p>}
      {a.interview_at ? (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-snow/80">
          <Video className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{interviewTime(a.interview_at)} Uhr</span>
        </p>
      ) : a.next_step && (
        <p className={clsx("mt-2 flex items-center gap-1.5 text-[12px]", late ? "text-error" : "text-snow/65")}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {a.next_step}
            {a.next_step_at && ` · ${new Date(a.next_step_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}`}
          </span>
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between text-[12px] text-snow/45">
        <span className="flex items-center gap-1.5">
          {relativeTime(a.received_at ?? a.created_at)}
          {!!a.attachment_names?.length && <Paperclip className="h-3 w-3" aria-label="mit Anhang" />}
        </span>
        {a.source === "website" ? (
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> Website
          </span>
        ) : (
          a.mailbox && <span>{mailboxLabel(a.mailbox)}</span>
        )}
      </div>
      {!overlay && open && a.email && !a.invited_at && !a.interview_at && <InviteButton application={a} />}
    </BoardCard>
  );
}

type Form = Record<"name" | "email" | "phone" | "position_title" | "owner" | "next_step" | "next_step_at" | "notes", string>;

function toLocalInput(value: string) {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const toForm = (a: Application): Form => ({
  name: a.name ?? "",
  email: a.email ?? "",
  phone: a.phone ?? "",
  position_title: a.position_title ?? "",
  owner: a.owner ?? "",
  next_step: a.next_step ?? "",
  next_step_at: a.next_step_at ? toLocalInput(a.next_step_at) : "",
  notes: a.notes ?? "",
});

const fromForm = (f: Form): Partial<Application> => ({
  name: f.name.trim(),
  email: f.email.trim() || null,
  phone: f.phone.trim() || null,
  position_title: f.position_title.trim() || null,
  owner: f.owner.trim() || null,
  next_step: f.next_step.trim() || null,
  next_step_at: f.next_step_at ? new Date(f.next_step_at).toISOString() : null,
  notes: f.notes.trim() || null,
});

function ApplicationSheet({ application, open, onClose }: { application?: Application; open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={application?.name ?? "Bewerbung"}
      subtitle={application && [application.position_title, `eingegangen ${relativeTime(application.received_at ?? application.created_at)}`].filter(Boolean).join(" · ")}
    >
      {application ? (
        <ApplicationDetail key={application.id} application={application} onClose={onClose} />
      ) : (
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      )}
    </Sheet>
  );
}

function ApplicationDetail({ application: a, onClose }: { application: Application; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(a));
  const [saving, setSaving] = useState(false);
  const [stageBusy, setStageBusy] = useState<ApplicationStage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(a));
  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  async function save() {
    if (!form.name.trim()) return toast("Name fehlt", "error");
    setSaving(true);
    try {
      await updateRow<Application>("applications", a.id, fromForm(form));
      toast("Gespeichert");
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  async function moveTo(stage: ApplicationStage) {
    if (stage === a.stage) return;
    setStageBusy(stage);
    try {
      await updateRow<Application>("applications", a.id, { stage, position: topPosition() });
    } catch {
      toast("Phase konnte nicht geändert werden", "error");
    }
    setStageBusy(null);
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteRow("applications", a.id);
      toast("Gelöscht");
      onClose();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <div>
        <p className="mb-2 text-xs font-medium text-snow/60">Phase</p>
        <div className="grid grid-cols-5 gap-1 rounded-2xl bg-ink/60 p-1">
          {APPLICATION_STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => moveTo(stage.id)}
              disabled={stageBusy !== null}
              aria-pressed={a.stage === stage.id}
              aria-busy={stageBusy === stage.id || undefined}
              className={clsx(
                "rounded-xl px-1 py-2 text-[11px] leading-tight font-medium transition-colors disabled:cursor-progress",
                a.stage === stage.id ? "bg-snow text-sky" : "text-snow/55 hover:bg-snow/8 hover:text-snow/85"
              )}
            >
              {stageBusy === stage.id ? <Spinner className="mx-auto h-3.5 w-3.5 text-current" /> : stage.label}
            </button>
          ))}
        </div>
      </div>

      <InterviewSection application={a} />

      {a.source === "website" && (
        <div>
          <p className="text-xs font-medium text-snow/60">Unterlagen</p>
          {a.files?.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {a.files.map((file, i) => (
                <FileChip key={file.path} applicationId={a.id} index={i} file={file} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-snow/45">Keine Dateien</p>
          )}
          {a.link && (
            <a
              href={/^https?:\/\//i.test(a.link) ? a.link : `https://${a.link}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-[13px] break-all text-snow/75 underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {a.link}
            </a>
          )}
          <p className="mt-2 text-[12px] text-snow/45">Eingegangen über das Bewerbungsformular der Website</p>
        </div>
      )}

      {a.mailbox && a.graph_id && (
        <div>
          <p className="text-xs font-medium text-snow/60">Unterlagen</p>
          <Attachments mailbox={a.mailbox} messageId={a.graph_id} />
          <p className="mt-2 text-[12px] text-snow/45">Eingegangen über {a.mailbox}</p>
        </div>
      )}

      {a.message && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-snow/60">Anschreiben</p>
          <p className="max-h-56 overflow-y-auto rounded-2xl bg-snow/[0.04] p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-snow/80">{a.message}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *">{(id) => <Input id={id} value={form.name} onChange={set("name")} />}</Field>
        <Field label="Stelle">{(id) => <Input id={id} value={form.position_title} onChange={set("position_title")} />}</Field>
        <Field label="E-Mail">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
        <Field label="Telefon">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} />}</Field>
        <Field label="Nächster Schritt" className="col-span-2 sm:col-span-1">
          {(id) => <Input id={id} value={form.next_step} onChange={set("next_step")} placeholder="z. B. Gespräch vereinbaren" />}
        </Field>
        <Field label="Fällig am" className="col-span-2 sm:col-span-1">
          {(id) => <Input id={id} type="datetime-local" value={form.next_step_at} onChange={set("next_step_at")} />}
        </Field>
        <Field label="Verantwortlich" className="col-span-2">
          {(id) => <Input id={id} value={form.owner} onChange={set("owner")} placeholder="name@grid-agency.de" />}
        </Field>
        <Field label="Notizen" className="col-span-2">
          {(id) => <Textarea id={id} rows={4} value={form.notes} onChange={set("notes")} />}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={saving} loadingText="Wird gespeichert …" disabled={!dirty}>
          Speichern
        </Button>
        {a.email && (
          <Link
            href={`/mail?to=${encodeURIComponent(a.email)}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 text-sm font-medium hover:bg-snow/12"
          >
            <Mail className="h-4 w-4" /> Mail schreiben
          </Link>
        )}
        <Button variant="ghost" className="ml-auto text-error" onClick={() => setConfirmDelete(true)}>
          Löschen
        </Button>
      </div>
      <p className="text-[12px] text-snow/40">Zuletzt geändert {formatDateTime(a.updated_at)}</p>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Bewerbung löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={deleting} loadingText="Wird gelöscht …" onClick={remove}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          {a.source === "website"
            ? "Die Karte und die hochgeladenen Unterlagen werden endgültig gelöscht."
            : "Die Karte wird entfernt. Die Mail im Postfach bleibt erhalten."}
        </p>
      </Dialog>
    </div>
  );
}

function InterviewSection({ application: a }: { application: Application }) {
  const { invite, busy, canInvite } = useInvite(a);
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-snow/60">Vorstellungsgespräch</p>
      {a.interview_at ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-snow/[0.04] p-4">
          <Video className="h-4 w-4 shrink-0 text-snow/60" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-medium">{interviewTime(a.interview_at)} Uhr</p>
            <p className="text-snow/55">Termin mit Video-Call im Kalender von {a.invited_by_name ?? a.invited_by}</p>
          </div>
          {a.interview_url && (
            <a
              href={a.interview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-snow/15 bg-snow/[0.06] px-3.5 text-[13px] font-medium hover:bg-snow/12"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Beitreten
            </a>
          )}
        </div>
      ) : a.invited_at ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-snow/[0.04] p-4">
          <CalendarClock className="h-4 w-4 shrink-0 text-snow/60" />
          <p className="min-w-0 flex-1 text-[13px] text-snow/70">
            Eingeladen {relativeTime(a.invited_at)} von {a.invited_by_name ?? a.invited_by}, wartet auf Terminwahl
          </p>
          <Button size="sm" onClick={invite} loading={busy} loadingText="Wird gesendet …">
            Erneut senden
          </Button>
        </div>
      ) : canInvite ? (
        <Button variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={invite} loading={busy} loadingText="Wird eingeladen …">
          Zum Gespräch einladen
        </Button>
      ) : (
        <p className="text-[13px] text-snow/45">Zum Einladen fehlt die E-Mail-Adresse.</p>
      )}
      {!a.interview_at && canInvite && (
        <p className="mt-2 text-[12px] text-snow/45">
          Mail von hello@ mit Button zur Terminwahl in deinem Outlook-Kalender (30 Min., Video-Call).
        </p>
      )}
    </div>
  );
}

/** Unterlage aus dem Website-Formular; lädt über die API (privater Bucket). */
function FileChip({ applicationId, index, file }: { applicationId: string; index: number; file: ApplicationFile }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function download() {
    setBusy(true);
    try {
      const response = await apiFetch(`/api/personal/applications/${applicationId}/files/${index}`);
      const url = URL.createObjectURL(await response.blob());
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

function NewApplicationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast("Name fehlt", "error");
    setBusy(true);
    try {
      const row = await createRow<Application>("applications", {
        name: name.trim(),
        position_title: title.trim() || null,
        stage: "neu",
        position: topPosition(),
      });
      setName("");
      setTitle("");
      onClose();
      onCreated(row.id);
    } catch {
      toast("Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Neue Bewerbung">
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Name *">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <Field label="Stelle">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Werkstudent*in Social Media" />}</Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird angelegt …">
            Anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
