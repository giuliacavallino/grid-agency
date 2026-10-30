"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CirclePause, MessagesSquare, RefreshCw, Send, Unplug } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource, useRows } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { accentFill } from "@/lib/theme";
import type { TaskProject } from "@/lib/tasks";
import { Badge, Button, Dialog, Empty, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { PersonAvatar } from "@/components/person";
import { PageBar } from "@/components/sales/shell";

const URL_SENDER = "/api/sender";
const URL_CHATS = "/api/sender/chats";
const URL_LOG = "/api/sender/log";
const URL_PROJECTS = "/api/sales/task_projects";

type Kind = "weekly" | "monthly";
type Sender = { email: string; name: string; connected_at: string; connected_by: string } | null;
type Status = {
  sender: Sender;
  ready: { secret: boolean; vault: "ok" | "missing" | "invalid"; claude: boolean };
  /** Grund, warum gerade nichts gesendet wird (null = aktiv) */
  paused: string | null;
};
type SenderChat = { id: string; title: string; chatType: string; members: string[]; lastAt: string | null };
type SenderMessage = { id: string; at: string; from: string | null; text: string; mine: boolean };
type UpdateLog = {
  id: string;
  created_at: string;
  project_id: string;
  kind: Kind;
  period: string;
  chat_id: string | null;
  text: string | null;
  status: "sent" | "failed" | "skipped" | "preview";
  error: string | null;
  sent_by: string | null;
};

const KIND_LABEL: Record<Kind, string> = { weekly: "Wochen-Update", monthly: "Reporting" };
const STATUS: Record<UpdateLog["status"], { label: string; color?: string }> = {
  sent: { label: "Verschickt", color: "#30a46c" },
  failed: { label: "Fehler", color: "#e5484d" },
  skipped: { label: "Ausgelassen" },
  preview: { label: "Vorschau" },
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const writePreview = (projectId: string, kind: Kind) =>
  api<UpdateLog>("/api/sender/run", { method: "POST", body: JSON.stringify({ project_id: projectId, kind, send: false }) });

async function saveProject(id: string, patch: Partial<TaskProject>) {
  const saved = await api<TaskProject>(`/api/sender/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  mutate<TaskProject[]>(URL_PROJECTS, (list) => list.map((p) => (p.id === id ? saved : p)));
  return saved;
}

/** Admin → Absender & Updates: Die Absenderin (ein normales M365-Konto)
 * schickt freitags ein Wochen-Update und am ersten Werktag des Monats das
 * Reporting in die zugeordneten Kundenchats. Claude schreibt die Texte. */
export function SenderSettings() {
  const toast = useToast();
  const status = useResource<Status>(URL_SENDER);

  // Rückkehr von der Microsoft-Anmeldung
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("connected") && !params.has("error")) return;
    if (params.get("connected")) toast("Absender-Konto verbunden");
    else toast(params.get("error") ?? "Verbinden fehlgeschlagen", "error");
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast]);

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Absender & Updates" meta="Wochen-Update freitags · Reporting am ersten Werktag" />
      {status.error ? (
        <Empty title="Absender konnte nicht geladen werden" text={status.error.message} />
      ) : status.loading || !status.data ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-12">
          <PausedNotice status={status.data} />
          <SenderCard status={status.data} />
          <Customers status={status.data} />
          <History />
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, meta }: { children: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 px-4 pt-8 pb-3 md:px-6">
      <h2 className="text-[15px] font-medium">{children}</h2>
      {meta && <span className="text-[12.5px] text-snow/55">{meta}</span>}
    </div>
  );
}

/** Was fehlt, bevor Updates rausgehen. Solange etwas fehlt, sendet der
 * Server nichts und ruft auch Claude nicht auf. */
function setupSteps({ sender, ready }: Status) {
  return [
    { done: ready.vault === "ok", text: ready.vault === "invalid" ? "VAULT_KEY in Vercel ist ungültig (32 Byte, base64)" : "VAULT_KEY in Vercel anlegen und neu deployen" },
    { done: ready.secret, text: "MS_CLIENT_SECRET in Vercel anlegen" },
    { done: ready.claude, text: "ANTHROPIC_API_KEY in Vercel anlegen (für die Texte)" },
    { done: !!sender, text: "Absender-Konto mit Teams-Lizenz verbinden (kein geteiltes Postfach)" },
  ];
}

function PausedNotice({ status }: { status: Status }) {
  const steps = setupSteps(status);
  if (!status.paused && steps.every((s) => s.done)) return null;
  return (
    <section className="px-4 pt-5 md:px-6">
      <div className="max-w-3xl rounded-2xl px-4 py-3.5 md:px-5" style={{ background: accentFill("#f5a524", 14) }} role="status">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <CirclePause className="h-[18px] w-[18px]" />
          Updates pausiert: Es wird nichts gesendet
        </p>
        <ul className="mt-2 space-y-1 text-[13px] text-snow/75">
          {steps.map((step) => (
            <li key={step.text} className={clsx("flex gap-2", step.done && "text-snow/45 line-through")}>
              <span aria-hidden>{step.done ? "✓" : "○"}</span>
              {step.text}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-snow/60">Anleitung: docs/absender-setup.md im Intranet-Repository.</p>
      </div>
    </section>
  );
}

function SenderCard({ status }: { status: Status }) {
  const toast = useToast();
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState<"connect" | "disconnect" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { sender, ready } = status;
  // Verbinden geht erst, wenn das Konto verschlüsselt gespeichert werden kann
  const canConnect = ready.vault === "ok" && ready.secret;

  async function connect() {
    setBusy("connect");
    try {
      const { url } = await api<{ url: string }>(`${URL_SENDER}/connect`, {
        method: "POST",
        body: JSON.stringify({ login_hint: hint || sender?.email }),
      });
      window.location.assign(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Verbinden fehlgeschlagen", "error");
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      await api(URL_SENDER, { method: "DELETE" });
      revalidate(URL_SENDER);
      setConfirm(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Trennen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <section className="px-4 pt-5 md:px-6">
      <div className="max-w-3xl rounded-2xl border border-snow/[0.08] bg-panel p-4 md:p-5">
        {sender ? (
          <div className="flex flex-wrap items-center gap-3">
            <PersonAvatar name={sender.name} email={sender.email} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{sender.name}</p>
              <p className="truncate text-[12.5px] text-snow/60">
                {sender.email} · verbunden am {dateTime(sender.connected_at)}
              </p>
            </div>
            <Button size="sm" icon={<RefreshCw className="h-4 w-4" />} loading={busy === "connect"} loadingText="Weiterleiten …" disabled={!canConnect} onClick={connect}>
              Neu verbinden
            </Button>
            <Button size="sm" variant="ghost" icon={<Unplug className="h-4 w-4" />} onClick={() => setConfirm(true)}>
              Trennen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[15px] font-medium">Absender-Konto verbinden</p>
            <p className="text-[13px] leading-relaxed text-snow/65">
              Die Updates gehen von einem normalen Microsoft-365-Konto mit Teams aus, wie von einer Kollegin. Lege das Konto an, füge es in die
              Kundenchats ein und melde es hier einmal an.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder="E-Mail des Kontos, z. B. sophia.conti@grid-agency.de"
                aria-label="E-Mail des Absender-Kontos"
                className="h-10 min-w-0 flex-1 basis-64"
              />
              <Button
                variant="primary"
                icon={<Send className="h-4 w-4" />}
                loading={busy === "connect"}
                loadingText="Weiterleiten …"
                disabled={!canConnect}
                onClick={connect}
              >
                Mit Microsoft verbinden
              </Button>
            </div>
            {!canConnect && <p className="text-[12.5px] text-snow/60">Verbinden geht erst, wenn VAULT_KEY und MS_CLIENT_SECRET in Vercel gesetzt sind.</p>}
          </div>
        )}
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Absender-Konto trennen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy === "disconnect"} loadingText="Wird getrennt …" onClick={disconnect}>
              Trennen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">Danach gehen keine automatischen Updates mehr raus, bis wieder ein Konto verbunden ist.</p>
      </Dialog>
    </section>
  );
}

function Customers({ status }: { status: Status }) {
  const projects = useRows<TaskProject>("task_projects");
  const chats = useResource<SenderChat[]>(status.sender ? URL_CHATS : null);
  const active = (projects.data ?? []).filter((p) => !p.archived && !p.restricted);

  return (
    <section>
      <SectionTitle meta="Chat zuordnen und einschalten, was automatisch rausgeht">Kunden</SectionTitle>
      {chats.error && <p className="px-4 pb-2 text-[12.5px] text-error md:px-6">Chats konnten nicht geladen werden: {chats.error.message}</p>}
      {projects.loading ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : active.length === 0 ? (
        <p className="px-4 text-[13px] text-snow/55 md:px-6">Keine aktiven Kunden in Aufgaben.</p>
      ) : (
        <ul className="border-t border-snow/[0.06]">
          {active.map((project) => (
            <li key={project.id}>
              <CustomerRow project={project} chats={chats.data ?? []} connected={!!status.sender} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CustomerRow({ project, chats, connected }: { project: TaskProject; chats: SenderChat[]; connected: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [replies, setReplies] = useState(false);
  const known = chats.some((c) => c.id === project.teams_chat_id);

  async function save(patch: Partial<TaskProject>, key: string) {
    setBusy(key);
    try {
      await saveProject(project.id, patch);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  const toggle = (key: "weekly_update" | "monthly_report", label: string) => {
    const on = !!project[key];
    return (
      <button
        type="button"
        onClick={() => save({ [key]: !on }, key)}
        disabled={busy !== null || (!on && !project.teams_chat_id)}
        title={!project.teams_chat_id ? "Erst einen Chat zuordnen" : undefined}
        aria-pressed={on}
        aria-busy={busy === key || undefined}
        className={clsx(
          "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress",
          on ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/60 hover:border-snow/35 hover:text-snow"
        )}
      >
        {busy === key && <Spinner className="h-3 w-3 text-current" />}
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-snow/[0.06] px-4 py-3.5 md:px-6">
      <div className="flex min-w-0 basis-48 items-center gap-2.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: project.color }} />
        <span className="truncate text-[15px] font-medium">{project.name}</span>
      </div>

      <Select
        value={project.teams_chat_id ?? ""}
        onChange={(e) => {
          const chat = chats.find((c) => c.id === e.target.value);
          save({ teams_chat_id: chat?.id ?? null, teams_chat_title: chat?.title ?? null }, "chat");
        }}
        disabled={!connected || busy !== null}
        aria-label={`Teams-Chat für ${project.name}`}
        aria-busy={busy === "chat" || undefined}
        className="h-9 min-w-0 flex-1 basis-56 md:max-w-xs"
      >
        <option value="">{connected ? "Kein Chat" : "Erst Absender verbinden"}</option>
        {project.teams_chat_id && !known && <option value={project.teams_chat_id}>{project.teams_chat_title ?? "Zugeordneter Chat"}</option>}
        {chats.map((chat) => (
          <option key={chat.id} value={chat.id}>
            {chat.title}
          </option>
        ))}
      </Select>

      <div className="flex flex-wrap gap-1.5">
        {toggle("weekly_update", "Wochen-Update")}
        {toggle("monthly_report", "Reporting")}
      </div>

      <div className="ml-auto flex gap-1.5">
        <Button size="sm" variant="ghost" icon={<MessagesSquare className="h-4 w-4" />} disabled={!project.teams_chat_id || !connected} onClick={() => setReplies(true)}>
          Chat
        </Button>
        <Button size="sm" icon={<CalendarClock className="h-4 w-4" />} disabled={!connected} onClick={() => setPreview(true)}>
          Vorschau
        </Button>
      </div>

      {preview && <PreviewDialog project={project} onClose={() => setPreview(false)} />}
      {replies && project.teams_chat_id && <RepliesSheet project={project} chatId={project.teams_chat_id} onClose={() => setReplies(false)} />}
    </div>
  );
}

function PreviewDialog({ project, onClose }: { project: TaskProject; onClose: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>(project.monthly_report && !project.weekly_update ? "monthly" : "weekly");
  const [result, setResult] = useState<UpdateLog | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"write" | "send" | null>("write");

  function generate(nextKind: Kind) {
    return writePreview(project.id, nextKind)
      .then((log) => {
        setResult(log);
        setText(log.text ?? "");
      })
      .catch((error: Error) => toast(error.message || "Text konnte nicht erstellt werden", "error"))
      .finally(() => setBusy(null));
  }

  function rewrite(nextKind: Kind) {
    setKind(nextKind);
    setBusy("write");
    void generate(nextKind);
  }

  async function send() {
    setBusy("send");
    try {
      const log = await api<UpdateLog>("/api/sender/run", { method: "POST", body: JSON.stringify({ project_id: project.id, kind, send: true, text }) });
      revalidate(URL_LOG);
      if (log.status === "sent") {
        toast(`${KIND_LABEL[kind]} an ${project.name} verschickt`);
        onClose();
        return;
      }
      toast(log.error ?? "Nicht verschickt", "error");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Senden fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  // Beim Öffnen gleich einen Text schreiben
  useEffect(() => {
    void generate(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Update an ${project.name}`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" icon={<RefreshCw className="h-4 w-4" />} disabled={busy !== null} onClick={() => rewrite(kind)}>
            Neu schreiben
          </Button>
          <Button
            variant="primary"
            icon={<Send className="h-4 w-4" />}
            loading={busy === "send"}
            loadingText="Wird gesendet …"
            disabled={busy !== null || !text.trim() || !project.teams_chat_id}
            onClick={send}
          >
            Jetzt senden
          </Button>
        </>
      }
    >
      <div className="mb-3 flex gap-1.5">
        {(["weekly", "monthly"] as Kind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => k !== kind && rewrite(k)}
            disabled={busy !== null}
            aria-pressed={kind === k}
            className={clsx(
              "h-8 rounded-full border px-3 text-[12.5px] transition-colors disabled:opacity-60",
              kind === k ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/60 hover:text-snow"
            )}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {busy === "write" ? (
        <div className="flex items-center gap-2 py-10 text-[13px] text-snow/60" aria-busy>
          <Spinner className="h-4 w-4" /> Text wird geschrieben …
        </div>
      ) : result && !result.text ? (
        <p className="rounded-xl bg-snow/[0.05] px-3 py-3 text-[13px] text-snow/70">Kein Update: {result.error ?? "nichts zu berichten"}</p>
      ) : (
        <>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} aria-label="Text des Updates" className="w-full text-[14px] leading-relaxed" />
          <p className="mt-2 text-[12px] text-snow/50">
            {project.teams_chat_id ? `Geht an „${project.teams_chat_title ?? "Chat"}“.` : "Noch kein Chat zugeordnet."} Du kannst den Text vor dem Senden anpassen.
          </p>
        </>
      )}
    </Dialog>
  );
}

function RepliesSheet({ project, chatId, onClose }: { project: TaskProject; chatId: string; onClose: () => void }) {
  const messages = useResource<SenderMessage[]>(`${URL_CHATS}/${encodeURIComponent(chatId)}/messages`);
  return (
    <Sheet open onClose={onClose} title={project.teams_chat_title ?? project.name} subtitle="Letzte Nachrichten im Kundenchat">
      {messages.error ? (
        <Empty title="Chat konnte nicht geladen werden" text={messages.error.message} />
      ) : messages.loading ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : (messages.data ?? []).length === 0 ? (
        <Empty title="Noch keine Nachrichten" />
      ) : (
        <ul className="space-y-3 p-5">
          {(messages.data ?? []).map((m) => (
            <li key={m.id} className={clsx("flex", m.mine && "justify-end")}>
              <div className={clsx("max-w-[85%] rounded-2xl px-3.5 py-2.5", m.mine ? "bg-snow text-sky" : "bg-snow/[0.07]")}>
                <p className={clsx("mb-0.5 text-[11.5px]", m.mine ? "text-sky/70" : "text-snow/55")}>
                  {m.from ?? "Unbekannt"} · {dateTime(m.at)}
                </p>
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function History() {
  const log = useResource<UpdateLog[]>(URL_LOG);
  const projects = useRows<TaskProject>("task_projects");
  const name = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? "Kunde";
  const entries = (log.data ?? []).filter((e) => e.status !== "preview");

  return (
    <section>
      <SectionTitle meta="Was rausging oder warum nicht">Verlauf</SectionTitle>
      {log.error ? (
        <p className="px-4 text-[13px] text-error md:px-6">{log.error.message}</p>
      ) : log.loading ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="px-4 text-[13px] text-snow/55 md:px-6">Noch keine Updates.</p>
      ) : (
        <ul className="border-t border-snow/[0.06]">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-snow/[0.06]">
              <details className="group px-4 py-3 md:px-6">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge color={STATUS[entry.status].color}>{STATUS[entry.status].label}</Badge>
                  <span className="text-[14px] font-medium">{name(entry.project_id)}</span>
                  <span className="text-[13px] text-snow/60">
                    {KIND_LABEL[entry.kind]} {entry.period}
                  </span>
                  <span className="ml-auto text-[12.5px] text-snow/55">
                    {dateTime(entry.created_at)} · {entry.sent_by === "automatisch" ? "automatisch" : entry.sent_by}
                  </span>
                </summary>
                {entry.error && <p className="mt-2 text-[13px] text-snow/65">{entry.error}</p>}
                {entry.text && <p className="mt-2 rounded-xl bg-snow/[0.04] px-3 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap">{entry.text}</p>}
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
