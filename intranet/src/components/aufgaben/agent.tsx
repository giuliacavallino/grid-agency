"use client";

import { useEffect, useState } from "react";
import { Bot, Square } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate } from "@/lib/data";
import { AGENT_STATUS, type Task } from "@/lib/tasks";
import { accentFill } from "@/lib/theme";
import { Button, useToast } from "@/components/ui";

// To-do an den Agenten übergeben: Er arbeitet mit Recherche, Posts,
// CI-Grafiken und Videos. Protokoll und Ergebnis stehen hier.

const time = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AgentPanel({ task }: { task: Task }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"start" | "stop" | null>(null);
  const working = task.agent_status === "queued" || task.agent_status === "running";

  // Solange der Agent arbeitet, regelmäßig neu laden
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => revalidate("/api/sales/tasks"), 5000);
    return () => clearInterval(timer);
  }, [working]);

  async function run(action: "start" | "stop") {
    setBusy(action);
    try {
      await api(`/api/aufgaben/agent/${task.id}`, { method: action === "start" ? "POST" : "DELETE" });
      revalidate("/api/sales/tasks");
      if (action === "start") toast("Der Agent legt los");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  const status = task.agent_status ? AGENT_STATUS[task.agent_status] : null;
  const log = task.agent_log ?? [];

  return (
    <section className="rounded-2xl border border-snow/[0.08] bg-snow/[0.03] p-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: accentFill("#9085e9", 18), color: "#9085e9" }}>
          <Bot className={working ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium">Agent</p>
          <p className="text-[12px]" style={{ color: status?.color }}>
            {status ? status.label : <span className="text-snow/55">Recherchiert, schreibt Posts, rendert Videos – nach CI und Briefing</span>}
          </p>
        </div>
        {working ? (
          <Button size="sm" variant="ghost" icon={<Square className="h-3.5 w-3.5" />} loading={busy === "stop"} loadingText="…" onClick={() => run("stop")} disabled={task.agent_status === "running"}>
            Zurücknehmen
          </Button>
        ) : (
          <Button size="sm" variant="primary" icon={<Bot className="h-4 w-4" />} loading={busy === "start"} loadingText="Wird übergeben …" disabled={task.done} onClick={() => run("start")}>
            {task.agent_status ? "Erneut übergeben" : "An Agent übergeben"}
          </Button>
        )}
      </div>
      {task.agent_result && <p className="mt-3 rounded-xl bg-snow/[0.05] px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-line">{task.agent_result}</p>}
      {log.length > 0 && (
        <details className="mt-2.5" open={working}>
          <summary className="cursor-pointer text-[12px] text-snow/55">Protokoll ({log.length})</summary>
          <ol className="mt-2 grid gap-1 border-l border-snow/10 pl-3">
            {log.slice(-25).map((entry, index) => (
              <li key={index} className="text-[12px] text-snow/70">
                <span className="text-snow/40 tabular-nums">{time.format(new Date(entry.at))}</span> · {entry.text}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
