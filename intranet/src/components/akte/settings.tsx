"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Building2, CalendarHeart, Check, CircleDashed, Download, FolderOpen, KeyRound, Link2, Plug, Rocket, Save, Users } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { DEFAULT_AUTOPILOT, PROVIDERS, WEEKDAY_LABELS, type Autopilot, type PostProvider } from "@/lib/marketing";
import { PROJECT_COLORS, type TaskProject } from "@/lib/tasks";
import { useCan } from "@/components/access";
import { Button, Field, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { ProviderMark, useConnectFeedback, useMarketingStatus } from "@/components/marketing/common";
import { CanvaCard } from "@/components/marketing/hub";
import { URL_WORKSPACES, useCurrentWorkspace, WorkspaceLogo, type WorkspaceSummary } from "@/components/marketing/workspace";
import { AkteHeader } from "./header";

// Einstellungen der Kundenakte (unten in der Seitenleiste): oben die Akte
// selbst (Kanäle, Autopilot, Stammdaten), darunter der ganze Marketing Hub
// (Anbindungen, Kundenakten, Agent & API).

const SECTIONS = [
  {
    title: "Diese Akte",
    items: [
      { path: "", label: "Kanäle", icon: Link2 },
      { path: "autopilot", label: "Autopilot", icon: Rocket },
      { path: "stammdaten", label: "Stammdaten", icon: Building2 },
    ],
  },
  {
    title: "Marketing Hub",
    items: [
      { path: "anbindungen", label: "Anbindungen", icon: Plug },
      { path: "kundenakten", label: "Kundenakten", icon: Users },
      { path: "agent", label: "Agent & API", icon: Bot },
    ],
  },
];

export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  const base = `/akte/${workspace.id}/einstellungen`;
  const href = (path: string) => (path ? `${base}/${path}` : base);
  const active = (path: string) => (path ? pathname.startsWith(href(path)) : pathname === base);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <nav aria-label="Einstellungen" className="shrink-0 border-b border-snow/[0.08] md:w-56 md:border-r md:border-b-0 md:py-5">
        <p className="hidden px-5 pb-3 text-[17px] font-semibold md:block">Einstellungen</p>
        <div className="flex gap-1 overflow-x-auto px-3 py-2 md:block md:space-y-4 md:overflow-visible md:p-0 md:px-3">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex gap-1 md:block">
              <p className="hidden px-2 pb-1.5 text-[11px] font-medium tracking-wide text-snow/40 uppercase md:block">{section.title}</p>
              {section.items.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  href={href(path)}
                  aria-current={active(path) ? "page" : undefined}
                  className={clsx(
                    "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] whitespace-nowrap",
                    active(path) ? "bg-snow/[0.1] font-medium text-snow" : "text-snow/60 hover:bg-snow/[0.05] hover:text-snow"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} /> {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </nav>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Row({ ok, title, text, env }: { ok: boolean; title: string; text: string; env?: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-snow/[0.06] px-4 py-3 last:border-0">
      {ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#30a46c]" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-snow/35" />}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12.5px] text-snow/55">{text}</p>
      </div>
      <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium", ok ? "bg-[#30a46c]/15 text-[#30a46c]" : "bg-snow/[0.06] text-snow/55")}>
        {ok ? "Aktiv" : env ? `fehlt: ${env}` : "Nicht eingerichtet"}
      </span>
    </li>
  );
}

function Group({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {text && <p className="mt-0.5 text-[13px] text-snow/55">{text}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Anbindungen des ganzen Hubs: Canva, Plattform-Apps, KI und Werkzeuge */
export function Connections() {
  const status = useMarketingStatus();
  useConnectFeedback(() => revalidate("/api/marketing"));
  const s = status.data;
  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Anbindungen" meta="Gilt für alle Kundenakten. Schlüssel liegen in Vercel und werden hier nie angezeigt." />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!s ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="grid max-w-3xl gap-7 p-4 pb-12 md:p-7">
            <Group title="Design" text="Ein Canva-Konto für ganz GRID; Designs je Kundenakte in eigenen Ordnern.">
              <CanvaCard />
            </Group>
            <Group title="Social-Media-Plattformen" text="Je Plattform eine GRID-App. Kunden verbinden ihre Konten danach per Link, ohne eigene API-Rechte.">
              <ul className="rounded-2xl border border-snow/[0.08] bg-panel">
                <Row ok={s.configured.meta} title="Instagram + Facebook (Meta)" text="Posten auf Seiten und Business-Konten" env={s.env.meta} />
                <Row ok={s.configured.linkedin} title="LinkedIn (Community Management)" text="Posten auf Unternehmensseiten" env={s.env.linkedin} />
                <Row ok={s.configured.tiktok} title="TikTok" text="Videos und Foto-Posts" env={s.env.tiktok} />
              </ul>
            </Group>
            <Group title="KI & Agent" text="Recherche, Vorschläge, Texte und der Agent, der Aufgaben abarbeitet.">
              <ul className="rounded-2xl border border-snow/[0.08] bg-panel">
                <Row ok={s.anthropic} title="Claude" text="Trend-Recherche mit Websuche, Posts, Agent" env="ANTHROPIC_API_KEY" />
                <Row ok={s.agent} title="Agent-Schnittstelle" text="Externe Agenten arbeiten über die API des Hubs" env="AGENT_API_KEY" />
              </ul>
            </Group>
            <Group title="Bild, Video & Audio">
              <ul className="rounded-2xl border border-snow/[0.08] bg-panel">
                <Row ok title="CI-Grafiken & Bildbearbeitung" text="Grafiken in Farben, Schrift und Logo der Akte; Zuschnitt, Korrekturen" />
                <Row ok={s.tools.photoroom} title="Photoroom" text="Hintergrund entfernen oder ersetzen" env={s.tool_env.photoroom} />
                <Row ok={s.tools.claid} title="Claid.ai" text="Rohbilder verbessern und hochskalieren" env={s.tool_env.claid} />
                <Row ok={s.tools.creatomate} title="Creatomate" text="Videos aus Vorlagen, Schnitt, Motion Design" env={s.tool_env.creatomate} />
                <Row ok={s.tools.elevenlabs} title="ElevenLabs" text="Voiceover und Musik" env={s.tool_env.elevenlabs} />
                <Row ok={s.tools.whisper} title="Whisper" text="Untertitel und Transkripte" env={s.tool_env.whisper} />
              </ul>
            </Group>
            <Group title="Ablage & Sicherheit">
              <ul className="rounded-2xl border border-snow/[0.08] bg-panel">
                <Row ok={s.vault} title="Tresor für Zugänge" text="Tokens der Kanäle werden verschlüsselt gespeichert" env="VAULT_KEY" />
                <Row ok={s.sharepoint} title="SharePoint" text="Je Kundenakte ein Ordner für Bilder und Videos" env="SHAREPOINT_SITE" />
              </ul>
            </Group>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "" : "bg-snow/20")}
      style={checked ? { background: "var(--akte)" } : undefined}
    >
      <span className={clsx("absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Autopilot der Akte: wöchentliche Recherche und Planung, Agent für Call-To-dos */
export function AutopilotSettings() {
  const { workspace } = useCurrentWorkspace();
  const url = workspace ? `/api/marketing/workspaces/${workspace.id}/autopilot` : null;
  const saved = useResource<Autopilot>(url);
  if (!workspace || !saved.data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  return <AutopilotForm key={JSON.stringify(saved.data)} workspace={workspace} initial={saved.data} url={url!} />;
}

function AutopilotForm({ workspace, initial, url }: { workspace: WorkspaceSummary; initial: Autopilot; url: string }) {
  const toast = useToast();
  const [form, setForm] = useState<Autopilot>({ ...DEFAULT_AUTOPILOT, ...initial });
  const [busy, setBusy] = useState<"save" | "run" | null>(null);
  const set = <K extends keyof Autopilot>(key: K, value: Autopilot[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify({ ...DEFAULT_AUTOPILOT, ...initial });
  const connected = new Set(workspace.accounts.map((a) => a.provider));

  async function save() {
    setBusy("save");
    try {
      const next = await api<Autopilot>(url, { method: "PATCH", body: JSON.stringify(form) });
      mutate<Autopilot>(url, () => next);
      toast("Autopilot gespeichert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function run() {
    setBusy("run");
    try {
      if (dirty) await api<Autopilot>(url, { method: "PATCH", body: JSON.stringify(form) });
      const { result, autopilot } = await api<{ result: string; autopilot: Autopilot }>(url, { method: "POST" });
      mutate<Autopilot>(url, () => autopilot);
      revalidate(`/api/marketing/posts?workspace=${workspace.id}`);
      revalidate(`/api/marketing/ideas?workspace=${workspace.id}`);
      revalidate(URL_WORKSPACES);
      toast(result);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Autopilot fehlgeschlagen", "error");
      revalidate(url);
    }
    setBusy(null);
  }

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Autopilot" meta="Recherchiert jede Woche Trends, erstellt Posts in der CI und plant sie ein">
        <Button size="sm" className="h-9" icon={<Rocket className="h-4 w-4" />} loading={busy === "run"} loadingText="Läuft (1–3 Min.) …" disabled={busy !== null || !form.providers.length} onClick={run}>
          Jetzt ausführen
        </Button>
        <Button variant="primary" size="sm" className="h-9" icon={<Save className="h-4 w-4" />} loading={busy === "save"} loadingText="Wird gespeichert …" disabled={busy !== null || !dirty} onClick={save}>
          Speichern
        </Button>
      </AkteHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid max-w-3xl gap-5 p-4 pb-12 md:p-7">
          <section className="flex items-center gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-4">
            <Rocket className="h-5 w-5 text-snow/60" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Autopilot {form.enabled ? "an" : "aus"}</p>
              <p className="text-[12.5px] text-snow/55">
                {initial.last_run ? `Zuletzt ${new Date(initial.last_run).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}: ${initial.last_result ?? "–"}` : "Läuft einmal pro Woche, erstmals innerhalb einer Stunde nach dem Einschalten."}
              </p>
            </div>
            <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Autopilot an oder aus" />
          </section>

          <section className="grid gap-5 rounded-2xl border border-snow/[0.08] bg-panel p-5">
            <div>
              <p className="mb-2 text-[13px] font-medium">Plattformen</p>
              <div className="flex flex-wrap gap-2">
                {(["linkedin", "instagram", "facebook", "tiktok"] as PostProvider[]).map((p) => {
                  const on = form.providers.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("providers", on ? form.providers.filter((x) => x !== p) : [...form.providers, p])}
                      className={clsx("flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-[13px]", on ? "border-snow/40 bg-snow/[0.08]" : "border-snow/12 text-snow/55")}
                    >
                      <ProviderMark provider={p} /> {PROVIDERS[p].label}
                      {!connected.has(p) && <span className="text-[11px] text-snow/40">(nicht verbunden)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-[auto_1fr_auto]">
              <Field label="Posts pro Woche">
                {(id) => (
                  <Select id={id} value={String(form.per_week)} onChange={(e) => set("per_week", Number(e.target.value))} className="h-10 w-36">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}×
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-medium text-snow/60">Tage</p>
                <div className="flex flex-wrap gap-1">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const day = index + 1;
                    const on = form.weekdays.includes(day);
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("weekdays", on ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort())}
                        className={clsx("h-10 w-10 rounded-xl text-[13px] font-medium", on ? "bg-snow text-sky" : "bg-snow/[0.06] text-snow/60 hover:text-snow")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Field label="Uhrzeit">{(id) => <Input id={id} type="time" value={form.time} onChange={(e) => set("time", e.target.value)} className="h-10 w-36" />}</Field>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium">Veröffentlichen</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["review", "Mit Freigabe", "Posts landen als Entwurf mit Termin im Kalender; das Team gibt sie frei."],
                    ["auto", "Vollautomatisch", "Posts werden eingeplant und zum Termin veröffentlicht – ohne Freigabe."],
                  ] as const
                ).map(([mode, title, text]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={form.mode === mode}
                    onClick={() => set("mode", mode)}
                    className={clsx("rounded-xl border p-3.5 text-left", form.mode === mode ? "border-snow/50 bg-snow/[0.06]" : "border-snow/10 hover:border-snow/25")}
                  >
                    <p className="text-[14px] font-medium">{title}</p>
                    <p className="mt-0.5 text-[12.5px] text-snow/55">{text}</p>
                  </button>
                ))}
              </div>
            </div>

            <Field label="Themen-Fokus (optional)">
              {(id) => <Textarea id={id} rows={3} value={form.focus} onChange={(e) => set("focus", e.target.value)} placeholder="z. B. Recruiting, neue Speisekarte, Nachhaltigkeit – sonst wählt die Recherche selbst" />}
            </Field>
          </section>

          <section className="flex items-start gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-4">
            <Bot className="mt-0.5 h-5 w-5 text-snow/60" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">To-dos aus Calls an den Agenten</p>
              <p className="text-[12.5px] text-snow/55">GRID-To-dos aus ausgewerteten Calls werden automatisch übernommen und vom Agenten bearbeitet. Was er nicht selbst erledigen kann, meldet er zur Prüfung.</p>
            </div>
            <Toggle checked={form.agent_calls} onChange={(v) => set("agent_calls", v)} label="To-dos aus Calls automatisch an den Agenten" />
          </section>

          <DayAutopilotCard workspaceId={workspace.id} />
        </div>
      </div>
    </div>
  );
}

type DayAutopilot = { enabled: boolean; lead_days: number; post: boolean; carousel: boolean; story: boolean; done_count: number };

/** Tage-Autopilot: Entwürfe zu Social-Media-Tagen (speichert sofort) */
function DayAutopilotCard({ workspaceId }: { workspaceId: string }) {
  const toast = useToast();
  const url = `/api/marketing/workspaces/${workspaceId}/day-autopilot`;
  const { data } = useResource<DayAutopilot>(url);
  if (!data) return null;

  async function change(patch: Partial<DayAutopilot>) {
    const optimistic = { ...data!, ...patch };
    mutate<DayAutopilot>(url, () => optimistic);
    try {
      const saved = await api<DayAutopilot>(url, { method: "PUT", body: JSON.stringify(patch) });
      mutate<DayAutopilot>(url, () => saved);
    } catch (error) {
      revalidate(url);
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
  }

  const options = [
    ["post", "Post", "Feed-Post 4:5 zum Tag"],
    ["carousel", "Karussell erlaubt", "Bei passendem Thema 3–5 Slides statt Einzelbild"],
    ["story", "Story", "Story 9:16 am Morgen (Instagram, Facebook)"],
  ] as const;

  return (
    <section className="grid gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-4">
      <div className="flex items-start gap-4">
        <CalendarHeart className="mt-0.5 h-5 w-5 text-snow/60" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Tage-Autopilot {data.enabled ? "an" : "aus"}</p>
          <p className="text-[12.5px] text-snow/55">
            Vor passenden Tagen (Muttertag, Tag des Croissants, Kundentage …) entstehen Entwürfe mit Caption und Canva-Design in der CI, im Kundenordner in Canva und mit Termin im Planer. Das Team gibt frei oder wünscht Änderungen.
            {data.done_count > 0 && ` Bisher ${data.done_count} Anlässe bearbeitet.`}
          </p>
        </div>
        <Toggle checked={data.enabled} onChange={(v) => change({ enabled: v })} label="Tage-Autopilot an oder aus" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
        <Field label="Vorlauf">
          {(id) => (
            <Select id={id} value={String(data.lead_days)} onChange={(e) => change({ lead_days: Number(e.target.value) })} className="h-10 w-40">
              {[7, 10, 14, 21, 28].map((n) => (
                <option key={n} value={n}>
                  {n} Tage vorher
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap gap-2">
          {options.map(([key, title, text]) => (
            <button
              key={key}
              type="button"
              aria-pressed={data[key]}
              title={text}
              onClick={() => change({ [key]: !data[key] })}
              className={clsx("flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px]", data[key] ? "border-snow/40 bg-snow/[0.08]" : "border-snow/12 text-snow/55")}
            >
              {data[key] && <Check className="h-3.5 w-3.5" />}
              {title}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Stammdaten: Name, CI-Farben, Logo, Aufgabenliste, SharePoint */
export function MasterData() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  return <MasterForm key={workspace.id + workspace.color + workspace.name + workspace.project_id} workspace={workspace} />;
}

function MasterForm({ workspace }: { workspace: WorkspaceSummary }) {
  const toast = useToast();
  const canTasks = useCan("aufgaben");
  const projects = useResource<TaskProject[]>(canTasks ? "/api/sales/task_projects" : null);
  const [name, setName] = useState(workspace.name);
  const [color, setColor] = useState(workspace.color);
  const [secondary, setSecondary] = useState(workspace.secondary_color ?? "");
  const [project, setProject] = useState(workspace.project_id ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState<"save" | "folder" | "canva" | null>(null);
  const preview = logo ? URL.createObjectURL(logo) : workspace.logo_url;
  const avatarPreview = avatar ? URL.createObjectURL(avatar) : workspace.avatar_url;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    try {
      await api(`${URL_WORKSPACES}/${workspace.id}`, { method: "PATCH", body: JSON.stringify({ name, color, secondary_color: secondary || null, project_id: project || null }) });
      if (logo) {
        const form = new FormData();
        form.append("file", logo);
        await api(`${URL_WORKSPACES}/${workspace.id}/logo`, { method: "POST", body: form });
      }
      if (avatar) {
        const form = new FormData();
        form.append("file", avatar);
        await api(`${URL_WORKSPACES}/${workspace.id}/avatar`, { method: "POST", body: form });
        setAvatar(null);
      }
      revalidate(URL_WORKSPACES);
      toast("Gespeichert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function fromCanva() {
    setBusy("canva");
    try {
      const result = await api<{ design: string; updated: string[] }>(`${URL_WORKSPACES}/${workspace.id}/canva-ci`, { method: "POST" });
      revalidate(URL_WORKSPACES);
      toast(`Aus „${result.design}“ übernommen: ${result.updated.join(", ") || "nichts Neues"}. Bitte im Markenkit prüfen.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Canva nicht erreichbar", "error");
    }
    setBusy(null);
  }

  async function folder() {
    setBusy("folder");
    try {
      const { url } = await api<{ url: string }>(`${URL_WORKSPACES}/${workspace.id}`, { method: "POST" });
      window.open(url, "_blank", "noopener");
      revalidate(URL_WORKSPACES);
    } catch (error) {
      toast(error instanceof Error ? error.message : "SharePoint nicht erreichbar", "error");
    }
    setBusy(null);
  }

  return (
    <form onSubmit={save} className="flex h-full flex-col">
      <AkteHeader title="Stammdaten" meta="Name, CI-Farben und Logo färben die ganze Akte">
        <Button size="sm" className="h-9" icon={<FolderOpen className="h-4 w-4" />} loading={busy === "folder"} loadingText="Öffnet …" disabled={busy !== null} onClick={folder}>
          SharePoint-Ordner
        </Button>
        <Button type="submit" variant="primary" size="sm" className="h-9" icon={<Save className="h-4 w-4" />} loading={busy === "save"} loadingText="Wird gespeichert …" disabled={busy !== null || !name.trim()}>
          Speichern
        </Button>
      </AkteHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid max-w-3xl gap-5 p-4 pb-12 md:p-7">
          <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-5">
            <ProviderMark provider="canva" className="h-10 min-w-10 text-[12px]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Aus Canva übernehmen</p>
              <p className="text-[12.5px] text-snow/55">
                Holt Logo, Farben, Schriften und Vorgaben aus dem Canva-Design „CI – {workspace.name}“. Seite 1: nur das Logo, Seite 2: Farben, Schriften, gern Tonalität und Dos &amp; Don&apos;ts.
              </p>
            </div>
            <Button size="sm" className="h-9" icon={<Download className="h-4 w-4" />} loading={busy === "canva"} loadingText="Holt aus Canva …" disabled={busy !== null} onClick={fromCanva}>
              Übernehmen
            </Button>
          </section>
          <section className="grid gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-5">
            <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["Hauptfarbe", color, setColor],
                  ["Zweitfarbe", secondary || color, setSecondary],
                ] as const
              ).map(([label, value, change]) => (
                <Field key={label} label={label}>
                  {(id) => (
                    <div className="flex items-center gap-2">
                      <input id={id} type="color" value={value} onChange={(e) => change(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-snow/15 bg-transparent" />
                      <Input value={label === "Zweitfarbe" ? secondary : color} onChange={(e) => change(e.target.value)} placeholder="#" aria-label={`${label} als Hex`} className="font-mono" />
                    </div>
                  )}
                </Field>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Schnellauswahl">
              {PROJECT_COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={clsx("h-6 w-6 rounded-full border-2", c === color ? "border-snow" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
            <Field label="Logo (PNG, JPG oder WebP)">
              {(id) => (
                <div className="flex items-center gap-3">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Vorschau des Logos
                    <img src={preview} alt="" className="h-12 w-12 rounded-lg bg-white object-contain" style={{ boxShadow: `0 0 0 2px ${color}` }} />
                  ) : (
                    <span className="h-12 w-12 rounded-lg" style={{ background: color }} />
                  )}
                  <input id={id} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="text-[13px] text-snow/60 file:mr-3 file:rounded-full file:border-0 file:bg-snow/10 file:px-3 file:py-1.5 file:text-[13px] file:text-snow" />
                </div>
              )}
            </Field>
            <Field label="Profilbild wie bei Instagram (rund im Hub)">
              {(id) => (
                <div className="flex items-center gap-3">
                  <WorkspaceLogo workspace={{ ...workspace, avatar_url: avatarPreview }} size={52} box />
                  <input id={id} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} className="text-[13px] text-snow/60 file:mr-3 file:rounded-full file:border-0 file:bg-snow/10 file:px-3 file:py-1.5 file:text-[13px] file:text-snow" />
                </div>
              )}
            </Field>
            <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${secondary || color})` }} aria-hidden />
          </section>

          {canTasks && (
            <section className="grid gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-5">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 text-snow/60" />
                <div>
                  <p className="text-[15px] font-semibold">Aufgabenliste</p>
                  <p className="text-[12.5px] text-snow/55">To-dos, Briefing und Calls dieser Akte kommen aus dieser Liste.</p>
                </div>
              </div>
              <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Aufgabenliste" className="h-10">
                <option value="">Keine</option>
                {(projects.data ?? [])
                  .filter((p) => !p.archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </section>
          )}
        </div>
      </div>
    </form>
  );
}
