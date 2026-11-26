import "server-only";
import { DEMO } from "@/lib/config";
import type { Automation, AutomationRun, AutomationsView } from "@/lib/google";

// Make (make.com) für die Automationen einer Kundenakte: Status, Läufe,
// jetzt ausführen, pausieren/aktivieren. API-Token in MAKE_API_TOKEN
// (Make → Profil → API-Zugang, Scopes scenarios:read/write/run).

const BASE = () => (process.env.MAKE_API_URL ?? "https://eu1.make.com/api/v2").replace(/\/$/, "");
const ZONE = () => new URL(BASE()).origin;

export class MakeError extends Error {}

export const makeConfigured = () => DEMO || !!process.env.MAKE_API_TOKEN;

async function make<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MAKE_API_TOKEN;
  if (!token) throw new MakeError("MAKE_API_TOKEN fehlt");
  const response = await fetch(`${BASE()}${path}`, {
    ...init,
    headers: { Authorization: `Token ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new MakeError(`Make ${response.status}: ${data.message ?? data.detail ?? text.slice(0, 200)}`);
  return data as T;
}

type ScenarioRaw = {
  id: number;
  name: string;
  teamId: number;
  isActive: boolean;
  isPaused: boolean;
  nextExec: string | null;
  scheduling?: { type?: string; days?: number[]; time?: string; interval?: number };
};

type LogRaw = { id?: string; imtId?: string; timestamp: string; status?: number; duration?: number; operations?: number; type?: string; error?: { message?: string } | string };

const DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

/** „Mo–Fr 08:15“, „täglich 07:00“, „alle 15 Min.“, „nur manuell“ */
export function scheduleText(s: ScenarioRaw["scheduling"]): string {
  if (!s?.type || s.type === "on-demand") return "nur manuell";
  if (s.type === "indefinitely") return s.interval ? `alle ${Math.round(s.interval / 60)} Min.` : "laufend";
  if (s.type === "immediately") return "sofort bei neuen Daten";
  if (s.type === "daily") return `täglich ${s.time ?? ""}`.trim();
  if (s.type === "weekly" && s.days?.length) {
    const days = [...s.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const contiguous = days.every((d, i) => i === 0 || (d - days[i - 1] + 7) % 7 === 1);
    const label = contiguous && days.length > 2 ? `${DAYS[days[0]]}–${DAYS[days.at(-1)!]}` : days.map((d) => DAYS[d]).join(", ");
    return `${label} ${s.time ?? ""}`.trim();
  }
  return s.type;
}

const runStatus = (status?: number): AutomationRun["status"] => (status === 1 ? "ok" : status === 2 ? "warnung" : status === 3 ? "fehler" : "laeuft");

async function loadScenario(id: number): Promise<Automation> {
  try {
    const [{ scenario }, logs] = await Promise.all([
      make<{ scenario: ScenarioRaw }>(`/scenarios/${id}`),
      make<{ scenarioLogs: LogRaw[] }>(`/scenarios/${id}/logs?pg%5Blimit%5D=30&pg%5BsortDir%5D=desc`).catch(() => ({ scenarioLogs: [] as LogRaw[] })),
    ]);
    // Nur echte Ausführungen (automatisch oder manuell), keine Änderungs-Ereignisse
    const runs = logs.scenarioLogs
      .filter((l) => (l.imtId || l.id) && typeof l.status === "number" && (!l.type || l.type === "auto" || l.type === "manual"))
      .slice(0, 10)
      .map((l) => ({
        id: String(l.imtId ?? l.id),
        at: l.timestamp,
        status: runStatus(l.status),
        duration: l.duration ?? null,
        operations: l.operations ?? null,
        error: typeof l.error === "string" ? l.error : (l.error?.message ?? null),
      }));
    return {
      id: scenario.id,
      name: scenario.name,
      active: scenario.isActive && !scenario.isPaused,
      schedule: scheduleText(scenario.scheduling),
      next_run: scenario.isActive ? scenario.nextExec : null,
      url: `${ZONE()}/${scenario.teamId}/scenarios/${scenario.id}/edit`,
      runs,
    };
  } catch (error) {
    return { id, name: `Szenario ${id}`, active: false, schedule: "–", next_run: null, url: `${ZONE()}`, runs: [], error: error instanceof Error ? error.message : "Nicht erreichbar" };
  }
}

// ---------- Vorschau ----------

const demoState = new Map<number, boolean>();
function demoScenario(id: number): Automation {
  const day = 86_400_000;
  const active = demoState.get(id) ?? true;
  const runs: AutomationRun[] = Array.from({ length: 8 }, (_, i) => ({
    id: `demo-${id}-${i}`,
    at: new Date(Date.now() - (i + 1) * day).toISOString(),
    status: i === 3 ? "fehler" : i === 5 ? "warnung" : "ok",
    duration: 42_000 + i * 1300,
    operations: 40 + i,
    error: i === 3 ? "Google Business Profile: 429 Too Many Requests" : null,
  }));
  return { id, name: "Rezensionen alle Filialen", active, schedule: "Mo–Fr 08:15", next_run: active ? new Date(Date.now() + day / 2).toISOString() : null, url: "https://eu1.make.com", runs };
}

export async function listAutomations(ids: number[]): Promise<AutomationsView> {
  if (DEMO) return { configured: true, scenarios: (ids.length ? ids : [1]).map(demoScenario) };
  if (!process.env.MAKE_API_TOKEN) return { configured: false, scenarios: ids.map((id) => ({ id, name: `Szenario ${id}`, active: false, schedule: "–", next_run: null, url: ZONE(), runs: [] })) };
  return { configured: true, scenarios: await Promise.all(ids.map(loadScenario)) };
}

export type AutomationAction = "run" | "start" | "stop";

export async function actOnAutomation(id: number, action: AutomationAction) {
  if (DEMO) {
    if (action !== "run") demoState.set(id, action === "start");
    return;
  }
  if (action === "run") await make(`/scenarios/${id}/run`, { method: "POST", body: JSON.stringify({ responsive: false }) });
  else await make(`/scenarios/${id}/${action}`, { method: "POST" });
}
