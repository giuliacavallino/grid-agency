"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, FileText, RotateCcw, Video, X } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { api } from "@/lib/api";
import { revalidate, useRows } from "@/lib/data";
import type { TaskProject } from "@/lib/tasks";
import { Badge, Button, Empty, Select, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

// Aufgaben → Aus Calls: Je aufgezeichnetem Call (meet.grid-agency.de)
// Zusammenfassung, Transkript und vorgeschlagene Aufgaben. Ein Klick
// übernimmt einen Vorschlag als To-do ins Kundenprojekt.

type Meeting = { id: string; title: string; starts_at: string; host_name: string | null; participants: { name: string }[] | null };
type Recording = {
  id: string;
  created_at: string;
  meeting_id: string;
  status: "laeuft" | "verarbeitung" | "fertig" | "fehler";
  error: string | null;
  duration_ms: number | null;
  chunks: unknown[] | null;
  transcript: { phrases?: { speaker: number | null; offset_ms: number; text: string }[] } | null;
  summary: string | null;
};
type Proposal = {
  id: string;
  recording_id: string;
  title: string;
  notes: string | null;
  owner: "grid" | "kunde";
  due_on: string | null;
  status: "vorschlag" | "uebernommen" | "verworfen";
  project_id: string | null;
  decided_by: string | null;
};

const dateTime = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dateShort = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "numeric", month: "short" });
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

function ProposalRow({ proposal, projects }: { proposal: Proposal; projects: TaskProject[] }) {
  const toast = useToast();
  const [project, setProject] = useState(proposal.project_id ?? "");
  const [busy, setBusy] = useState<"uebernehmen" | "verwerfen" | null>(null);
  const open = proposal.status === "vorschlag";

  async function decide(action: "uebernehmen" | "verwerfen") {
    setBusy(action);
    try {
      await api(`/api/aufgaben/vorschlaege/${proposal.id}`, { method: "POST", body: JSON.stringify({ action, project_id: project || undefined }) });
      revalidate("/api/sales/meeting_tasks");
      if (action === "uebernehmen") {
        revalidate("/api/sales/tasks");
        toast(`„${proposal.title}“ übernommen`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  return (
    <li className={clsx("flex flex-col gap-3 rounded-2xl border border-snow/10 bg-surface p-4 md:flex-row md:items-start", !open && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={clsx("font-medium", proposal.status === "verworfen" && "line-through")}>{proposal.title}</p>
          <Badge color={proposal.owner === "kunde" ? "#4f5bd5" : "#fa7e1e"}>{proposal.owner === "kunde" ? "Kunde" : "GRID"}</Badge>
          {proposal.due_on && <Badge>bis {dateShort.format(new Date(`${proposal.due_on}T12:00:00`))}</Badge>}
        </div>
        {proposal.notes && <p className="mt-1 text-sm whitespace-pre-line text-snow/65">{proposal.notes}</p>}
        {!open && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-snow/50">
            {proposal.status === "uebernommen" ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5" />}
            {proposal.status === "uebernommen" ? `Übernommen${projects.find((p) => p.id === proposal.project_id) ? ` in ${projects.find((p) => p.id === proposal.project_id)!.name}` : ""}` : "Verworfen"}
            {proposal.decided_by && ` von ${proposal.decided_by}`}
          </p>
        )}
      </div>
      {open && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Kunde" className="h-9 w-48">
            <option value="">Kunde wählen …</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} onClick={() => decide("uebernehmen")} disabled={!project || !!busy} loading={busy === "uebernehmen"} loadingText="Wird übernommen …">
            Übernehmen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => decide("verwerfen")} disabled={!!busy} loading={busy === "verwerfen"} loadingText="…">
            Verwerfen
          </Button>
        </div>
      )}
    </li>
  );
}

function RecordingCard({ recording, meeting, proposals, projects }: { recording: Recording; meeting?: Meeting; proposals: Proposal[]; projects: TaskProject[] }) {
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const phrases = recording.transcript?.phrases ?? [];
  const open = proposals.filter((p) => p.status === "vorschlag");

  async function retry() {
    setRetrying(true);
    try {
      await api(`/api/aufgaben/aufnahmen/${recording.id}`, { method: "POST" });
      revalidate("/api/sales/meeting_recordings");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Hat nicht geklappt", "error");
    }
    setRetrying(false);
  }

  return (
    <section className="rounded-3xl border border-snow/10 bg-panel p-5">
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-snow/[0.08]">
          <Video className="h-5 w-5 text-snow/70" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">{meeting?.title ?? "Call"}</h2>
          <p className="text-[13px] text-snow/55">
            {dateTime.format(new Date(meeting?.starts_at ?? recording.created_at))} Uhr
            {recording.duration_ms ? ` · ${Math.max(1, Math.round(recording.duration_ms / 60_000))} Min.` : ""}
            {meeting?.participants?.length ? ` · ${meeting.participants.map((p) => p.name).join(", ")}` : ""}
          </p>
        </div>
        {recording.status === "laeuft" && <Badge color="#d62976">Aufnahme läuft</Badge>}
        {recording.status === "verarbeitung" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-snow/60">
            <Spinner className="h-3.5 w-3.5" /> Wird ausgewertet …
          </span>
        )}
        {recording.status === "fertig" && open.length > 0 && <Badge color="#fa7e1e">{open.length} offen</Badge>}
      </header>

      {recording.status === "fehler" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{recording.error ?? "Auswertung fehlgeschlagen"}</span>
          {recording.chunks && (
            <Button size="sm" variant="secondary" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={retry} loading={retrying} loadingText="Wird gestartet …">
              Erneut versuchen
            </Button>
          )}
        </div>
      )}

      {recording.summary && <p className="mt-4 text-[15px] leading-relaxed text-snow/80">{recording.summary}</p>}

      {proposals.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {proposals.map((p) => (
            <ProposalRow key={p.id} proposal={p} projects={projects} />
          ))}
        </ul>
      )}
      {recording.status === "fertig" && proposals.length === 0 && <p className="mt-4 text-sm text-snow/50">Keine Aufgaben erkannt.</p>}

      {phrases.length > 0 && (
        <div className="mt-4">
          <button type="button" onClick={() => setShowTranscript((v) => !v)} className="inline-flex items-center gap-1.5 text-sm text-snow/60 hover:text-snow" aria-expanded={showTranscript}>
            <FileText className="h-4 w-4" /> Transkript
            <ChevronDown className={clsx("h-4 w-4 transition-transform", showTranscript && "rotate-180")} />
          </button>
          {showTranscript && (
            <ol className="mt-3 max-h-96 space-y-2 overflow-y-auto rounded-2xl bg-snow/[0.04] p-4 text-sm">
              {phrases.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-10 shrink-0 text-right text-xs text-snow/40 tabular-nums">{clock(p.offset_ms)}</span>
                  <span className="w-20 shrink-0 text-xs font-medium text-snow/55">{p.speaker ? `Sprecher ${p.speaker}` : "–"}</span>
                  <span className="min-w-0 flex-1 text-snow/80">{p.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

export function CallResults() {
  const recordings = useRows<Recording>("meeting_recordings");
  const proposals = useRows<Proposal>("meeting_tasks");
  const meetings = useRows<Meeting>("meetings");
  const projects = useRows<TaskProject>("task_projects");
  const active = useMemo(() => (projects.data ?? []).filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, "de")), [projects.data]);
  const byMeeting = useMemo(() => new Map((meetings.data ?? []).map((m) => [m.id, m])), [meetings.data]);
  const openCount = (proposals.data ?? []).filter((p) => p.status === "vorschlag").length;
  const error = recordings.error ?? proposals.error ?? meetings.error;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Aus Calls" meta={proposals.data && `${openCount} ${openCount === 1 ? "Vorschlag" : "Vorschläge"} offen`} />
      {error ? (
        <Empty title="Calls konnten nicht geladen werden" text={error.message} />
      ) : recordings.loading || proposals.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : !recordings.data?.length ? (
        <Empty
          icon={<Video className="h-8 w-8" />}
          title="Noch keine Calls ausgewertet"
          text="Calls unter meet.grid-agency.de werden aufgezeichnet und transkribiert. Danach stehen hier Zusammenfassung und vorgeschlagene Aufgaben zur Freigabe."
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 pb-10 md:p-6">
            {recordings.data.map((r) => (
              <RecordingCard
                key={r.id}
                recording={r}
                meeting={byMeeting.get(r.meeting_id)}
                proposals={(proposals.data ?? []).filter((p) => p.recording_id === r.id)}
                projects={active}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
