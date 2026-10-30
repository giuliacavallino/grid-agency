import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { db, sb, type Row } from "./db";
import { sendAsSender, senderInfo } from "./sender";

// Automatische Kunden-Updates über das Absender-Konto: freitags ein kurzes
// Wochen-Update, am ersten Werktag des Monats das Reporting für den Vormonat.
// Claude formuliert aus den Aufgaben (nur Titel, keine Notizen) und dem
// Briefing (Tonalität). Ohne ANTHROPIC_API_KEY geht nichts raus, damit nie
// rohe interne To-do-Titel beim Kunden landen.

export type UpdateKind = "weekly" | "monthly";

export type UpdateLog = {
  id: string;
  created_at: string;
  project_id: string;
  kind: UpdateKind;
  period: string;
  chat_id: string | null;
  text: string | null;
  status: "sent" | "failed" | "skipped" | "preview";
  error: string | null;
  sent_by: string | null;
};

const TZ = "Europe/Berlin";
const DAY = 86_400_000;

function berlinParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), weekday: parts.weekday as string };
}

function isoWeek(date: Date) {
  const { year, month, day } = berlinParts(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Erster Werktag (Mo–Fr) des Monats in Berlin? */
export function isFirstWorkday(date: Date) {
  const { day, weekday } = berlinParts(date);
  if (["Sat", "Sun"].includes(weekday)) return false;
  return day === 1 || (weekday === "Mon" && day <= 3);
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Zeitraum eines Updates: Woche bis heute bzw. der Vormonat */
export function periodFor(kind: UpdateKind, now: Date) {
  if (kind === "weekly") {
    return { period: isoWeek(now), from: new Date(now.getTime() - 7 * DAY), to: now, label: "diese Woche" };
  }
  const { year, month } = berlinParts(now);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return {
    period: `${prevYear}-${String(prevMonth).padStart(2, "0")}`,
    from: new Date(Date.UTC(prevYear, prevMonth - 1, 1)),
    to: new Date(Date.UTC(year, month - 1, 1)),
    label: `im ${MONTHS[prevMonth - 1]} ${prevYear}`,
  };
}

const SYSTEM = `Du schreibst Teams-Nachrichten an Kund*innen von GRID AGENCY, einer Social-Media-Agentur, im Namen der angegebenen Mitarbeiterin.

Regeln:
- Deutsch, freundlich, kurz und konkret, wie eine aufmerksame Account-Managerin im Chat. Anrede an das Kundenteam mit „ihr“, außer das Briefing zeigt eine andere Anrede. Grußformel mit dem Vornamen der Mitarbeiterin.
- Nur Fakten aus den gelieferten Aufgaben verwenden. Nichts erfinden, keine Zahlen erfinden, keine Termine zusagen, die nicht in den Daten stehen.
- Rein interne Punkte weglassen: Rechnungen, Zahlungen, Zugänge, Passwörter, interne Absprachen, Personal, alles über GRID-Mitarbeitende. Aufgaben in kundenverständliche Sprache umformulieren.
- Keine Inhalte aus dem Briefing wiederholen (Kontakte, Zugänge, Postingplan); das Briefing dient nur für Tonalität und Kontext.
- Reiner Text ohne Markdown-Überschriften. Aufzählungen mit „• “. Höchstens 2 Emojis.
- Gibt es nichts Kundenrelevantes zu berichten, antworte exakt mit: NICHTS`;

let client: Anthropic | null = null;

type Context = { project: Row; tasks: Row[]; kind: UpdateKind; senderName: string; now: Date };

function prompt({ project, tasks, kind, senderName, now }: Context) {
  const { from, to, label } = periodFor(kind, now);
  const inRange = (value: unknown) => typeof value === "string" && value >= from.toISOString() && value < to.toISOString();
  const done = tasks.filter((t) => t.done && inRange(t.done_at)).map((t) => `• ${t.title}`);
  const soon = new Date(now.getTime() + (kind === "weekly" ? 10 : 31) * DAY).toISOString().slice(0, 10);
  const next = tasks
    .filter((t) => !t.done && (!t.due_on || String(t.due_on) <= soon))
    .sort((a, b) => String(a.due_on ?? "9999").localeCompare(String(b.due_on ?? "9999")))
    .slice(0, 12)
    .map((t) => `• ${t.title}${t.due_on ? ` (bis ${t.due_on})` : ""}`);
  return {
    hasContent: done.length + next.length > 0,
    text: [
      `Art: ${kind === "weekly" ? "Wochen-Update (Freitag, kurz: max. 8 Zeilen)" : `Monats-Reporting für den Zeitraum ${label} (gegliedert: Erledigt, Als Nächstes; max. 20 Zeilen)`}`,
      `Kunde: ${project.name}`,
      `Mitarbeiterin (Absenderin): ${senderName}`,
      "",
      `Erledigt ${label}:`,
      done.join("\n") || "(nichts)",
      "",
      "Offen bzw. als Nächstes:",
      next.join("\n") || "(nichts)",
      "",
      "Social-Media-Zahlen: noch nicht angebunden, keine Zahlen nennen.",
      "",
      "Briefing (nur für Tonalität und Kontext):",
      String(project.briefing ?? "").slice(0, 2500) || "(kein Briefing)",
    ].join("\n"),
  };
}

async function write(context: Context): Promise<{ text: string | null; reason?: string }> {
  const { text: input, hasContent } = prompt(context);
  if (!hasContent) return { text: null, reason: "Nichts zu berichten" };
  if (DEMO && !process.env.ANTHROPIC_API_KEY) {
    return { text: `Hallo ihr Lieben,\n\nkurzes Update von uns ✨\n• (Vorschau ohne Claude)\n\nLiebe Grüße\n${context.senderName.split(" ")[0]}` };
  }
  if (!process.env.ANTHROPIC_API_KEY) return { text: null, reason: "ANTHROPIC_API_KEY fehlt" };
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM,
    messages: [{ role: "user", content: input }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") return { text: null, reason: "Kein Text erhalten" };
  const text = block.text.trim();
  if (!text || text === "NICHTS") return { text: null, reason: "Nichts Kundenrelevantes" };
  return { text: text.slice(0, 4000) };
}

// ---------- Protokoll ----------

const demoLog: UpdateLog[] = [];

async function saveLog(entry: Omit<UpdateLog, "id" | "created_at">): Promise<UpdateLog> {
  if (DEMO) {
    const row = { id: `demo-u${demoLog.length + 1}`, created_at: new Date().toISOString(), ...entry };
    demoLog.unshift(row);
    return row;
  }
  const { data, error } = await sb().from("customer_updates").insert(entry).select().single();
  if (error) throw new Error(error.message);
  return data as UpdateLog;
}

export async function listLog(limit = 60): Promise<UpdateLog[]> {
  if (DEMO) return demoLog.slice(0, limit);
  const { data, error } = await sb().from("customer_updates").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data as UpdateLog[];
}

async function alreadySent(projectId: string, kind: UpdateKind, period: string) {
  if (DEMO) return demoLog.some((e) => e.project_id === projectId && e.kind === kind && e.period === period && e.status === "sent");
  const { count, error } = await sb()
    .from("customer_updates")
    .select("id", { count: "exact", head: true })
    .match({ project_id: projectId, kind, period, status: "sent" });
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

// ---------- Ablauf ----------

/** Update für einen Kunden schreiben und (mit send) verschicken. Mit text
 * geht ein schon geprüfter (ggf. bearbeiteter) Vorschau-Text raus. */
export async function runUpdate(
  projectId: string,
  kind: UpdateKind,
  options: { send: boolean; by: string; now?: Date; text?: string }
) {
  const now = options.now ?? new Date();
  const { period } = periodFor(kind, now);
  const project = await db().get("task_projects", projectId);
  if (!project) throw new Error("Kunde nicht gefunden");
  const chatId = (project.teams_chat_id as string | null) ?? null;
  const base = { project_id: projectId, kind, period, chat_id: chatId, sent_by: options.by };

  // Pro Kunde, Art und Zeitraum höchstens eine Nachricht (auch von Hand)
  if (options.send && (await alreadySent(projectId, kind, period))) {
    return saveLog({ ...base, text: null, status: "skipped", error: "Für diesen Zeitraum schon verschickt" });
  }
  const sender = await senderInfo();
  if (!sender) return saveLog({ ...base, text: null, status: "skipped", error: "Kein Absender-Konto verbunden" });

  let text: string | null = options.text?.trim().slice(0, 4000) || null;
  if (!text) {
    try {
      const tasks = await db().list("tasks", { project_id: projectId });
      const result = await write({ project, tasks, kind, senderName: sender.name, now });
      if (!result.text) return saveLog({ ...base, text: null, status: "skipped", error: result.reason ?? null });
      text = result.text;
    } catch (error) {
      return saveLog({ ...base, text: null, status: "failed", error: error instanceof Error ? error.message : "Text konnte nicht erstellt werden" });
    }
  }

  if (!options.send) return saveLog({ ...base, text, status: "preview", error: null });
  if (!chatId) return saveLog({ ...base, text, status: "skipped", error: "Kein Teams-Chat zugeordnet" });
  try {
    await sendAsSender(chatId, text);
    return saveLog({ ...base, text, status: "sent", error: null });
  } catch (error) {
    return saveLog({ ...base, text, status: "failed", error: error instanceof Error ? error.message : "Senden fehlgeschlagen" });
  }
}

/** Cron: alle aktiven Kunden mit eingeschaltetem Update und Chat */
export async function runDue(kind: UpdateKind, now = new Date()) {
  const flag = kind === "weekly" ? "weekly_update" : "monthly_report";
  const projects = (await db().list("task_projects")).filter((p) => !p.archived && !p.restricted && p[flag] && p.teams_chat_id);
  const results = [];
  for (const project of projects) {
    results.push(await runUpdate(project.id, kind, { send: true, by: "automatisch", now }));
  }
  return results;
}
