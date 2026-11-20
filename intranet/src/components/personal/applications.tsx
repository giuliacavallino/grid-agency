"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import {
  Archive,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  Download,
  ExternalLink,
  LayoutGrid,
  Mail,
  Paperclip,
  Plus,
  Table,
  Video,
  X,
} from "lucide-react";
import { api, apiFetch } from "@/lib/api";
import { mailboxLabel } from "@/lib/config";
import { createRow, deleteRow, mutate, updateRow, useRows } from "@/lib/data";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { APPLICATION_STAGES, topPosition, type Application, type ApplicationFile, type ApplicationStage } from "@/lib/sales/types";
import { Button, Dialog, Empty, Field, Input, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { formatSize } from "@/components/sales/mail/format";
import { Attachments } from "@/components/sales/mail/reading-pane";
import {
  cardClass,
  FilterBar,
  FilterOption,
  FilterPill,
  OwnerLine,
  PANEL_CLASS,
  QUICK_VIEWS,
  QuickViews,
  SearchPill,
  Segmented,
  since,
  startOfWeek,
  TagChip,
  useOwnerMatch,
  type QuickView,
  type SegmentOption,
} from "@/components/sales/pipeline";
import { ApplicantBoard } from "./board";

const STAGE_COLOR = Object.fromEntries(APPLICATION_STAGES.map((s) => [s.id, s.color])) as Record<ApplicationStage, string>;
const STAGE_LABEL = Object.fromEntries(APPLICATION_STAGES.map((s) => [s.id, s.label])) as Record<ApplicationStage, string>;
/** Spalten: unsere Phasen, „Neue Bewerbung“ kurz als „Neu“ */
const COLUMNS = APPLICATION_STAGES.map((s) => (s.id === "neu" ? { ...s, label: "Neu" } : s));
const isClosed = (a: Application) => a.stage === "zusage" || a.stage === "absage";
const WEBSITE = "#d95926";
const MAILBOX = "#3987e5";

type View = "board" | "tabelle" | "archiv";
const VIEWS: readonly SegmentOption<View>[] = [
  { id: "board", label: "Board", icon: LayoutGrid },
  { id: "tabelle", label: "Tabelle", icon: Table },
  { id: "archiv", label: "Archiv", icon: Archive },
];

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Bewerber-Pipeline als Kanban: Neue Bewerbung (automatisch aus dem Formular
 * der Website und aus den Postfächern) → Gespräch → Case Study → Zusage / Absage. */
export function Applications() {
  const { data: applications, loading, error } = useRows<Application>("applications");
  const toast = useToast();
  const owners = useOwnerMatch();
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [job, setJob] = useState("");
  const [quick, setQuick] = useState<QuickView | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => new Date());
  const weekStart = useMemo(() => startOfWeek(now).getTime(), [now]);

  const jobs = useMemo(
    () => [...new Set((applications ?? []).map((a) => a.position_title).filter((t): t is string => !!t))].sort((a, b) => a.localeCompare(b, "de")),
    [applications]
  );

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (applications ?? []).filter(
      (a) => (!job || a.position_title === job) && (!q || [a.name, a.email, a.position_title, a.message].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [applications, query, job]);

  const quickMatch = useMemo(
    () => ({
      meine: (a: Application) => owners.isMine(a.owner) || owners.isMine(a.invited_by),
      neu: (a: Application) => a.stage === "neu" && !a.invited_at,
      woche: (a: Application) => new Date(a.received_at ?? a.created_at).getTime() >= weekStart,
      ohne: (a: Application) => !a.owner,
    }),
    [owners, weekStart]
  );
  const counts = useMemo(
    () => Object.fromEntries(QUICK_VIEWS.map((v) => [v.id, searched.filter((a) => !isClosed(a) && quickMatch[v.id](a)).length])) as Record<QuickView, number>,
    [searched, quickMatch]
  );
  const visible = useMemo(() => (quick ? searched.filter(quickMatch[quick]) : searched), [searched, quick, quickMatch]);

  const open = (applications ?? []).filter((a) => !isClosed(a));
  const today = open.filter((a) => a.interview_at && sameDay(new Date(a.interview_at), now)).length;

  async function move(application: Application, stage: string, position: number) {
    try {
      await updateRow<Application>("applications", application.id, { stage: stage as ApplicationStage, position });
    } catch {
      toast("Verschieben fehlgeschlagen", "error");
    }
  }

  return (
    <div className="flex h-full flex-col bg-sky">
      <h1 className="sr-only">Bewerber-Pipeline</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-1 md:px-6">
        <p className="text-[15px] text-snow/55">
          <strong className="mr-1 text-[22px] font-semibold text-snow tabular-nums">{applications ? open.length : "–"}</strong> offen ·{" "}
          {today === 0 ? "keine Termine heute" : today === 1 ? "1 Termin heute" : `${today} Termine heute`}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <Segmented label="Ansicht" value={view} onChange={setView} options={VIEWS} />
          <Button
            variant="primary"
            className="h-10 w-10 px-0 shadow-[0_4px_14px_var(--shadow-color)] sm:w-auto sm:px-4"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
            aria-label="Neue Bewerbung"
          >
            <span className="hidden sm:inline">Neue Bewerbung</span>
          </Button>
        </div>
      </div>

      {view !== "archiv" && (
        <FilterBar filter={<JobFilter jobs={jobs} value={job} onChange={setJob} />}>
          <SearchPill value={query} onChange={setQuery} label="Bewerbungen durchsuchen" className="w-56 shrink-0 lg:w-64" />
          <QuickViews value={quick} onChange={setQuick} counts={counts} />
        </FilterBar>
      )}

      {error ? (
        <Empty title="Bewerbungen konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : view === "tabelle" ? (
        <ApplicationTable applications={visible.filter((a) => !isClosed(a))} onOpen={setOpenId} />
      ) : view === "archiv" ? (
        <ApplicationArchive applications={(applications ?? []).filter(isClosed)} onOpen={setOpenId} />
      ) : (
        <ApplicantBoard
          columns={COLUMNS}
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

/** Stelle im Filter-Popover */
function JobFilter({ jobs, value, onChange }: { jobs: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <FilterPill active={value ? 1 : 0}>
      {(close) => {
        const choose = (next: string) => () => {
          onChange(next);
          close();
        };
        return (
          <div className="max-h-80 overflow-y-auto">
            <p className="px-3 pt-1.5 pb-1 text-[11.5px] font-semibold tracking-[0.08em] text-snow/45 uppercase">Stelle</p>
            <FilterOption selected={!value} onClick={choose("")}>
              Alle Stellen
            </FilterOption>
            {jobs.map((title) => (
              <FilterOption key={title} selected={value === title} onClick={choose(title)}>
                {title}
              </FilterOption>
            ))}
          </div>
        );
      }}
    </FilterPill>
  );
}

function SourceTag({ application: a }: { application: Application }) {
  if (a.source === "website") return <TagChip color={WEBSITE}>Website</TagChip>;
  if (a.mailbox) return <TagChip color={MAILBOX}>{mailboxLabel(a.mailbox)}</TagChip>;
  return <TagChip color="#afaaa0">Manuell</TagChip>;
}

function StageDot({ stage }: { stage: ApplicationStage }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

function ApplicationTable({ applications, onOpen }: { applications: Application[]; onOpen: (id: string) => void }) {
  const order = Object.fromEntries(APPLICATION_STAGES.map((s, i) => [s.id, i])) as Record<ApplicationStage, number>;
  const rows = [...applications].sort((a, b) => order[a.stage] - order[b.stage] || b.position - a.position);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
      <section className={PANEL_CLASS}>
        {rows.length === 0 ? (
          <Empty title="Keine offenen Bewerbungen" text="Mit diesen Filtern gibt es keine Bewerbungen im Prozess." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13.5px]">
              <thead>
                <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Phase</th>
                  <th className="px-3 py-3 font-medium">Eingang über</th>
                  <th className="px-3 py-3 font-medium">Gespräch / nächster Schritt</th>
                  <th className="px-3 py-3 font-medium">Zuständig</th>
                  <th className="px-5 py-3 text-right font-medium">Eingang</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr
                    key={a.id}
                    tabIndex={0}
                    onClick={() => onOpen(a.id)}
                    onKeyDown={(e) => e.key === "Enter" && onOpen(a.id)}
                    className="cursor-pointer border-b border-snow/[0.05] last:border-0 hover:bg-snow/[0.03] focus-visible:bg-snow/[0.05] focus-visible:outline-none"
                  >
                    <td className="max-w-72 px-5 py-3">
                      <span className="block truncate font-semibold">{a.name}</span>
                      {a.position_title && <span className="block truncate text-[12px] text-snow/50">{a.position_title}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StageDot stage={a.stage} />
                    </td>
                    <td className="px-3 py-3">
                      <SourceTag application={a} />
                    </td>
                    <td className="max-w-64 truncate px-3 py-3 text-snow/70">
                      {a.interview_at
                        ? `${interviewTime(a.interview_at)} Uhr`
                        : a.next_step
                          ? `${a.next_step}${a.next_step_at ? ` · ${formatDate(a.next_step_at, { day: "numeric", month: "short" })}` : ""}`
                          : <span className="text-snow/40">–</span>}
                    </td>
                    <td className="px-3 py-3 text-snow/70">{a.owner || a.invited_by_name || <span className="text-snow/40">–</span>}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap text-snow/55">{since(a.received_at ?? a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Archiv: abgeschlossene Bewerbungen (Zusage, Absage) */
function ApplicationArchive({ applications, onOpen }: { applications: Application[]; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<"alle" | "zusage" | "absage">("alle");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications
      .filter((a) => filter === "alle" || a.stage === filter)
      .filter((a) => !q || [a.name, a.email, a.position_title].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [applications, filter, query]);
  const count = (stage: ApplicationStage) => applications.filter((a) => a.stage === stage).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4 md:px-6 md:pb-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchPill value={query} onChange={setQuery} label="Archiv durchsuchen" className="w-56 lg:w-64" />
        <Segmented
          label="Archiv filtern"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "alle", label: "Alle" },
            { id: "zusage", label: `Zusage · ${count("zusage")}` },
            { id: "absage", label: `Absage · ${count("absage")}` },
          ]}
        />
      </div>
      <section className={PANEL_CLASS}>
        {rows.length === 0 ? (
          <Empty title="Archiv ist leer" text="Bewerbungen mit Zusage oder Absage erscheinen hier." />
        ) : (
          <ul className="divide-y divide-snow/[0.06]">
            {rows.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-snow/[0.03]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAGE_COLOR[a.stage] }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">{a.name}</span>
                    <span className="block truncate text-[12.5px] text-snow/50">{[a.position_title, a.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right text-[12.5px]">
                    <span className="block font-medium">{STAGE_LABEL[a.stage]}</span>
                    <span className="block text-snow/45">{formatDate(a.updated_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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

/** Klicks in der Aktionsleiste öffnen nicht die Karte und starten kein Ziehen */
const stop = {
  onClick: (event: React.SyntheticEvent) => event.stopPropagation(),
  onPointerDown: (event: React.SyntheticEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.key !== "Escape" && event.stopPropagation(),
};

/** Ein Klick auf der Karte: lädt ein, ohne die Karte zu öffnen oder zu ziehen. */
function InviteButton({ application }: { application: Application }) {
  const { invite, busy } = useInvite(application);
  return (
    <Button
      size="sm"
      variant="primary"
      className="min-w-0 flex-1"
      icon={<CalendarPlus className="h-4 w-4" />}
      loading={busy}
      loadingText="Wird eingeladen …"
      onClick={invite}
    >
      Einladen ››
    </Button>
  );
}

/** Runder ✕-Button: Karte nach „Absage“ (lässt sich zurückziehen, keine Mail) */
function RejectButton({ application }: { application: Application }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function reject() {
    setBusy(true);
    try {
      await updateRow<Application>("applications", application.id, { stage: "absage", position: topPosition() });
      toast(`${application.name} nach „Absage“ verschoben`);
    } catch {
      toast("Verschieben fehlgeschlagen", "error");
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={reject}
      disabled={busy}
      aria-busy={busy || undefined}
      aria-label="Absage"
      title="Absage (nach „Absage“ verschieben)"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error/10 text-error transition-colors hover:bg-error/20 disabled:cursor-progress"
    >
      {busy ? <Spinner className="h-4 w-4 text-current" /> : <X className="h-4 w-4" />}
    </button>
  );
}

function ApplicationCard({ application: a, overlay }: { application: Application; overlay?: boolean }) {
  const late = a.next_step_at && new Date(a.next_step_at) < new Date();
  const open = !isClosed(a);
  const canInvite = open && !!a.email && !a.invited_at && !a.interview_at;
  return (
    <article className={cardClass(overlay)} style={{ borderLeftColor: STAGE_COLOR[a.stage] }}>
      <div className="flex items-center gap-2">
        <SourceTag application={a} />
        {!!a.attachment_names?.length && <Paperclip className="h-3.5 w-3.5 shrink-0 text-snow/40" aria-label="mit Anhang" />}
        <span className="ml-auto shrink-0 text-[11.5px] text-snow/40 tabular-nums">
          {formatDate(a.received_at ?? a.created_at, { day: "2-digit", month: "2-digit" })}
        </span>
      </div>
      <p className="mt-2 truncate text-[15px] leading-snug font-semibold">{a.name}</p>
      {a.position_title && (
        <p className="flex items-center gap-1.5 truncate text-[13px] text-snow/55">
          <Briefcase className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">{a.position_title}</span>
        </p>
      )}
      {a.message && <p className="mt-1.5 truncate text-[12.5px] text-snow/50">{a.message}</p>}
      {a.interview_at ? (
        <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-snow/[0.04] px-2.5 py-1.5 text-[12.5px] font-medium text-snow/80">
          <Video className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">{interviewTime(a.interview_at)} Uhr</span>
        </p>
      ) : a.next_step ? (
        <p className={clsx("mt-2.5 flex items-center gap-2 rounded-xl bg-snow/[0.04] px-2.5 py-1.5 text-[12.5px]", late ? "text-error" : "text-snow/70")}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {a.next_step}
            {a.next_step_at && ` · ${new Date(a.next_step_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}`}
          </span>
        </p>
      ) : a.invited_at ? (
        <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-snow/[0.04] px-2.5 py-1.5 text-[12.5px] text-snow/55">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Eingeladen {relativeTime(a.invited_at)} · wartet auf Terminwahl</span>
        </p>
      ) : null}
      <div className="mt-3">
        <OwnerLine owner={a.owner ?? a.invited_by} time={since(a.received_at ?? a.created_at)} />
      </div>
      {!overlay && open && (
        <div {...stop} className="mt-3 flex items-center gap-2 border-t border-snow/[0.06] pt-3">
          <RejectButton application={a} />
          {canInvite && <InviteButton application={a} />}
          {!canInvite && a.interview_at && a.interview_url && (
            <a
              href={a.interview_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-3 text-[13px] font-medium hover:bg-snow/[0.12]"
            >
              <Video className="h-4 w-4 shrink-0" /> Beitreten
            </a>
          )}
        </div>
      )}
    </article>
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
