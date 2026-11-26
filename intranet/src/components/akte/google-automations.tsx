"use client";

import { useState } from "react";
import { CircleAlert, CircleCheck, CirclePause, ExternalLink, KeyRound, Play, Power, TriangleAlert, Workflow } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { mutate, useResource } from "@/lib/data";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { Automation, AutomationRun, AutomationsView } from "@/lib/google";
import { Button, Empty, Spinner, useToast } from "@/components/ui";
import { ToneBadge } from "@/components/google/overview";

// Automationen der Akte (Make-Szenarien): Status, Zeitplan, nächster Lauf,
// letzte Ausführungen; starten, pausieren, aktivieren. Welche Szenarien zur
// Akte gehören, steht in workspaces.settings.google.make_scenarios.

const RUN: Record<AutomationRun["status"], { label: string; tone: "success" | "warn" | "error" | "neutral"; icon: typeof CircleCheck }> = {
  ok: { label: "Erfolgreich", tone: "success", icon: CircleCheck },
  warnung: { label: "Mit Warnung", tone: "warn", icon: TriangleAlert },
  fehler: { label: "Fehler", tone: "error", icon: CircleAlert },
  laeuft: { label: "Läuft", tone: "neutral", icon: Play },
};

export function Automations({ workspaceId }: { workspaceId: string }) {
  const key = `/api/marketing/workspaces/${workspaceId}/google/automations`;
  const view = useResource<AutomationsView>(key);

  if (view.error) return <Empty title="Automationen konnten nicht geladen werden" text={view.error.message} />;
  if (!view.data) {
    return (
      <div className="grid h-40 place-items-center">
        <Spinner />
      </div>
    );
  }
  const { configured, scenarios } = view.data;

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      {!configured && <TokenHint />}
      {!scenarios.length ? (
        <Empty
          icon={<Workflow className="h-8 w-8" />}
          title="Keine Automation zugeordnet"
          text="Für diese Akte läuft noch kein Make-Szenario. Zuordnen lässt es sich über die Szenario-ID in den Einstellungen der Akte (settings.google.make_scenarios)."
        />
      ) : (
        scenarios.map((s) => <ScenarioCard key={s.id} scenario={s} url={key} disabled={!configured} />)
      )}
    </div>
  );
}

function TokenHint() {
  return (
    <div className="flex gap-3 rounded-2xl border border-snow/[0.1] bg-panel px-4 py-3.5 text-[13.5px] leading-relaxed text-snow/75">
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-snow/55" />
      <div>
        <p className="font-medium text-snow">Make ist noch nicht verbunden</p>
        <p className="mt-1">
          In Make unter Profil → <b>API-Zugang</b> einen Token anlegen (Scopes <code>scenarios:read</code>, <code>scenarios:write</code>, <code>scenarios:run</code>) und in Vercel im Projekt <b>grid-intranet</b> als <code>MAKE_API_TOKEN</code> hinterlegen. Danach erscheinen hier Status und Läufe.
        </p>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, url, disabled }: { scenario: Automation; url: string; disabled: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"run" | "start" | "stop" | null>(null);
  const failed = scenario.runs.filter((r) => r.status === "fehler").length;

  async function act(action: "run" | "start" | "stop") {
    if (action === "stop" && !window.confirm(`„${scenario.name}“ pausieren? Bis zum Aktivieren läuft es nicht mehr automatisch.`)) return;
    setBusy(action);
    try {
      const next = await api<AutomationsView>(url, { method: "POST", body: JSON.stringify({ scenario: scenario.id, action }) });
      mutate<AutomationsView>(url, () => next);
      toast(action === "run" ? "Lauf gestartet – das Ergebnis erscheint in ein paar Minuten" : action === "start" ? "Automation aktiviert" : "Automation pausiert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Das hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  return (
    <article className="rounded-2xl border border-snow/[0.08] bg-surface p-4 shadow-[0_2px_10px_var(--shadow-color)] md:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <p className="flex items-center gap-2 text-[15px] font-medium">
            {scenario.name}
            <a href={scenario.url} target="_blank" rel="noreferrer" className="text-snow/45 hover:text-snow" aria-label="In Make öffnen">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-snow/55">
            {scenario.active ? <ToneBadge tone="success">Aktiv</ToneBadge> : <ToneBadge tone="muted">Pausiert</ToneBadge>}
            <span>{scenario.schedule}</span>
            {scenario.next_run && <span>· nächster Lauf {formatDateTime(scenario.next_run)}</span>}
            {failed > 0 && <span className="text-error">· {failed} Fehler in den letzten Läufen</span>}
          </p>
          {scenario.error && <p className="mt-1.5 text-[12.5px] text-error">{scenario.error}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" icon={<Play className="h-4 w-4" />} loading={busy === "run"} loadingText="Wird gestartet …" disabled={disabled || busy !== null} onClick={() => act("run")}>
            Jetzt ausführen
          </Button>
          {scenario.active ? (
            <Button size="sm" variant="ghost" icon={<CirclePause className="h-4 w-4" />} loading={busy === "stop"} loadingText="Wird pausiert …" disabled={disabled || busy !== null} onClick={() => act("stop")}>
              Pausieren
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon={<Power className="h-4 w-4" />} loading={busy === "start"} loadingText="Wird aktiviert …" disabled={disabled || busy !== null} onClick={() => act("start")}>
              Aktivieren
            </Button>
          )}
        </div>
      </div>

      {scenario.runs.length > 0 && (
        <ul className="mt-4 divide-y divide-snow/[0.06] overflow-hidden rounded-xl border border-snow/[0.06]">
          {scenario.runs.map((run) => {
            const s = RUN[run.status];
            return (
              <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
                <s.icon className={cn("h-4 w-4 shrink-0", run.status === "ok" ? "text-success" : run.status === "fehler" ? "text-error" : "text-snow/55")} />
                <span className="tabular-nums" title={formatDateTime(run.at)}>
                  {formatDateTime(run.at)}
                </span>
                <span className="text-snow/45">{relativeTime(run.at)}</span>
                <span className="ml-auto flex items-center gap-2 text-[12px] text-snow/50 tabular-nums">
                  {run.operations != null && <span>{run.operations} Ops</span>}
                  {run.duration != null && <span>{Math.round(run.duration / 1000)} s</span>}
                  <ToneBadge tone={s.tone}>{s.label}</ToneBadge>
                </span>
                {run.error && <p className="w-full pl-7 text-[12px] text-error">{run.error}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
