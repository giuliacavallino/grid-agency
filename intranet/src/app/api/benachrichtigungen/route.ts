import { hasArea } from "@/lib/access";
import { DEMO } from "@/lib/config";
import { euro } from "@/lib/format";
import { berlinDate, fromBerlin, occurrences, type Recurrence } from "@/lib/jourfix";
import { SOURCES } from "@/lib/sales/types";
import { withUser, type User } from "@/lib/server/auth";
import { db, sb, visibleRows, type Row } from "@/lib/server/db";
import { meetUrl } from "@/lib/server/meet";
import { listPosts, listWorkspaces } from "@/lib/server/social/store";
import { getPostingPlan } from "@/lib/server/social/posting-plan";
import { gaps, progress, QUOTA_KINDS, rulesFor, windowOf, type PlanWindow, type PostingPlan } from "@/lib/posting-plan";
import type { SocialPost } from "@/lib/marketing";

// Benachrichtigungen für die Glocke in der Kopfzeile: was gerade auf das
// Konto wartet, aus allen Bereichen, die es sehen darf. Jede Quelle läuft
// für sich; fällt eine aus, fehlt nur sie.

export type NotificationKind = "lead" | "freigabe" | "agent" | "aufgabe" | "bewerbung" | "termin" | "postingplan";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  /** Zeitpunkt (ISO): Eingang, Fälligkeit bzw. Beginn des Termins */
  at: string;
  href: string;
};

const MAX_ITEMS = 40;
const PER_SOURCE = 15;
const DAY = 86_400_000;

const str = (value: unknown) => (typeof value === "string" ? value : "");
const iso = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  }
  return new Date().toISOString();
};
const newest = (rows: Row[], key: (row: Row) => string) =>
  rows.sort((a, b) => key(b).localeCompare(key(a))).slice(0, PER_SOURCE);

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

/** Heute in Berlin: Datum und Beginn/Ende des Tages */
function berlinToday(now = Date.now()) {
  const date = berlinDate(now);
  const [y, m, d] = date.split("-").map(Number);
  const start = fromBerlin(y, m, d, 0);
  const end = fromBerlin(y, m, d + 1, 0);
  return { date, start, end };
}

/** Kalendertag (yyyy-mm-dd) → Mitternacht in Berlin als ISO */
const dayStart = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(fromBerlin(y, m, d, 0)).toISOString();
};

// ---------- Quellen ----------

const sourceLabel = (id: unknown) => SOURCES.find((s) => s.id === id)?.label ?? null;

async function leads(): Promise<NotificationItem[]> {
  const since = Date.now() - 14 * DAY;
  const rows = (await db().list("leads", { stage: "neu" })).filter(
    (row) => row.status !== "verloren" && Date.parse(str(row.created_at)) >= since
  );
  return newest(rows, (row) => str(row.created_at)).map((row) => {
    const source = sourceLabel(row.source);
    const person = row.company && row.name ? str(row.name) : "";
    return {
      id: `lead-${row.id}`,
      kind: "lead",
      title: str(row.company) || str(row.name) || "Neuer Lead",
      text: ["Neuer Lead", person, source && `über ${source}`].filter(Boolean).join(" · "),
      at: iso(row.created_at),
      href: "/sales",
    };
  });
}

async function invoices(): Promise<NotificationItem[]> {
  const rows = await db().list("invoices", { stage: "neu" });
  return newest(rows, (row) => iso(row.received_at, row.created_at)).map((row) => {
    const amount = typeof row.amount === "number" ? euro(row.amount) : null;
    return {
      id: `rechnung-${row.id}`,
      kind: "freigabe",
      title: str(row.vendor) || "Eingangsrechnung",
      text: ["Rechnung wartet auf Freigabe", amount].filter(Boolean).join(" · "),
      at: iso(row.received_at, row.created_at),
      href: "/finance",
    };
  });
}

async function applications(): Promise<NotificationItem[]> {
  const rows = await db().list("applications", { stage: "neu" });
  return newest(rows, (row) => iso(row.received_at, row.created_at)).map((row) => ({
    id: `bewerbung-${row.id}`,
    kind: "bewerbung",
    title: str(row.name) || "Neue Bewerbung",
    text: row.position_title ? `Bewerbung: ${str(row.position_title)}` : "Neue Bewerbung",
    at: iso(row.received_at, row.created_at),
    href: "/personal",
  }));
}

/** To-dos, deren Agent-Ergebnis geprüft werden muss (oder fehlgeschlagen ist) */
async function agentTasks(user: User): Promise<NotificationItem[]> {
  const rows = check(
    await sb()
      .from("tasks")
      .select("id, title, project_id, agent_status, agent_at, updated_at")
      .in("agent_status", ["review", "failed"])
      .eq("done", false)
      .order("agent_at", { ascending: false, nullsFirst: false })
      .limit(PER_SOURCE)
  ) as Row[];
  return (await visibleRows(user, "tasks", rows)).map((row) => ({
    id: `agent-${row.id}`,
    kind: "agent",
    title: str(row.title) || "Aufgabe",
    text: row.agent_status === "failed" ? "Agent: Fehler, bitte ansehen" : "Agent ist fertig, bitte prüfen",
    at: iso(row.agent_at, row.updated_at),
    href: row.project_id ? `/aufgaben/${row.project_id}` : "/aufgaben",
  }));
}

/** Eigene To-dos, die heute fällig oder überfällig sind */
async function myTasks(user: User): Promise<NotificationItem[]> {
  const { date } = berlinToday();
  const names = [...new Set([user.name, user.member.name, user.email].filter(Boolean))];
  const rows = check(
    await sb()
      .from("tasks")
      .select("id, title, project_id, due_on")
      .eq("done", false)
      .in("assignee", names)
      .lte("due_on", date)
      .order("due_on", { ascending: false })
      .limit(PER_SOURCE)
  ) as Row[];
  return (await visibleRows(user, "tasks", rows)).map((row) => taskItem(row, date));
}

function taskItem(row: Row, today: string): NotificationItem {
  const due = str(row.due_on);
  const days = Math.round((Date.parse(today) - Date.parse(due)) / DAY);
  return {
    id: `aufgabe-${row.id}-${due}`,
    kind: "aufgabe",
    title: str(row.title) || "Aufgabe",
    text: days <= 0 ? "Heute fällig" : days === 1 ? "Seit gestern überfällig" : `Seit ${days} Tagen überfällig`,
    at: dayStart(due),
    href: "/aufgaben/meine",
  };
}

/** Neue Post-Vorschläge, je Kundenwelt zusammengefasst */
async function postIdeas(): Promise<NotificationItem[]> {
  const rows = check(
    await sb()
      .from("post_ideas")
      .select("id, created_at, workspace_id, title")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(200)
  ) as { id: string; created_at: string; workspace_id: string; title: string }[];
  if (!rows.length) return [];
  const workspaces = new Map((await listWorkspaces()).map((w) => [w.id, w.name]));
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    // Archivierte Kundenwelten liefert listWorkspaces nicht
    if (!workspaces.has(row.workspace_id)) continue;
    groups.set(row.workspace_id, [...(groups.get(row.workspace_id) ?? []), row]);
  }
  return [...groups].slice(0, PER_SOURCE).map(([workspaceId, ideas]) => ideaItem(workspaceId, workspaces.get(workspaceId) ?? "Kundenwelt", ideas));
}

function ideaItem(workspaceId: string, name: string, ideas: { id: string; created_at: string; title: string }[]): NotificationItem {
  return {
    // Mit dem neuesten Vorschlag in der ID, damit neue Vorschläge wieder auffallen
    id: `vorschlag-${workspaceId}-${ideas[0].id}`,
    kind: "freigabe",
    title: name,
    text: ideas.length === 1 ? `Neuer Post-Vorschlag: ${ideas[0].title}` : `${ideas.length} neue Post-Vorschläge`,
    at: iso(ideas[0].created_at),
    href: `/akte/${workspaceId}/vorschlaege`,
  };
}

/** Postingplan: was in der Woche (ab Donnerstag auch nächste Woche) und im
 * Monat noch einzuplanen ist, für die zuständige Person (ohne Zuständige:
 * für Admins) */
async function postingPlans(user: User): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  const { start } = berlinToday();
  for (const workspace of await listWorkspaces()) {
    const plan = await getPostingPlan(workspace.id);
    if (!plan.rules.length) continue;
    if (plan.owner ? plan.owner !== user.email.toLowerCase() : !user.admin) continue;
    const posts = await listPosts({ workspace_id: workspace.id, limit: 500 });
    const item = planItem(workspace.id, workspace.name, plan, posts, start);
    if (item) items.push(item);
  }
  return items;
}

function planItem(workspaceId: string, name: string, plan: PostingPlan, posts: SocialPost[], today: number): NotificationItem | null {
  const now = new Date(today + 12 * 3_600_000);
  const week = windowOf("week", now);
  const windows: PlanWindow[] = [week];
  // Ab Donnerstag rückt die nächste Woche in den Blick
  if ((now.getUTCDay() + 6) % 7 >= 3) windows.push(windowOf("week", new Date(now.getTime() + 7 * DAY)));
  windows.push(windowOf("month", now));
  const parts: string[] = [];
  for (const window of windows) {
    // Vor dem vollen Vertragsumfang nichts anmahnen
    if (plan.start && window.to < plan.start) continue;
    // Je Art zählt die strengste Regel (z. B. Wochenmenge und Rhythmus)
    const byKind = new Map<keyof typeof QUOTA_KINDS, number>();
    for (const p of rulesFor(plan, window.period)
      .filter((rule) => !(window.period === "month" && rule.period === "days"))
      .map((rule) => progress(rule, posts, window))) {
      byKind.set(p.rule.kind, Math.max(byKind.get(p.rule.kind) ?? 0, p.missing));
    }
    const missing = [...byKind]
      .filter(([, n]) => n > 0)
      .map(([kind, n]) => `${n} ${n === 1 ? QUOTA_KINDS[kind].one : QUOTA_KINDS[kind].label}`);
    if (missing.length) parts.push(`${window === windows[1] && window.period === "week" ? `nächste Woche (${window.label})` : window.label}: ${missing.join(", ")}`);
  }
  const holes = plan.rules.flatMap((rule) => gaps(rule, posts)).sort();
  if (holes.length) {
    const first = new Date(`${holes[0]}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
    parts.push(`Lücke im Rhythmus ab ${first}`);
  }
  if (!parts.length) return null;
  return {
    // Ändert sich der Stand, taucht der Hinweis wieder als neu auf
    id: `plan-${workspaceId}-${week.from}-${parts.join("|").length}`,
    kind: "postingplan",
    title: name,
    text: `Noch einplanen · ${parts.join(" · ")}`,
    // Einmal am Tag (8 Uhr) als neu, nicht bei jedem Abruf
    at: new Date(Math.min(today + 8 * 3_600_000, Date.now())).toISOString(),
    href: `/akte/${workspaceId}/planung`,
  };
}

type MeetingRow = {
  id: string;
  code: string;
  title: string;
  starts_at: string;
  recurrence: (Recurrence & { video?: boolean }) | null;
  valid_until: string | null;
  cancelled_at: string | null;
};

/** Calls, die das Konto heute leitet (Einzeltermine und Jour fixes) */
async function meetings(user: User): Promise<NotificationItem[]> {
  const { start, end } = berlinToday();
  const from = new Date(start).toISOString();
  const to = new Date(end).toISOString();
  const rows = check(
    await sb()
      .from("meetings")
      .select("id, code, title, starts_at, recurrence, valid_until, cancelled_at")
      .eq("host", user.email)
      .or(`and(starts_at.gte."${from}",starts_at.lt."${to}"),recurrence.not.is.null`)
      .limit(200)
  ) as MeetingRow[];
  return meetingItems(rows, start, end);
}

function meetingItems(rows: MeetingRow[], start: number, end: number): NotificationItem[] {
  const items: NotificationItem[] = [];
  for (const row of rows) {
    let at: number | undefined = Date.parse(row.starts_at);
    if (row.recurrence) {
      const until = row.cancelled_at ? Date.parse(row.valid_until ?? row.cancelled_at) : Infinity;
      const weeks = Math.ceil(Math.max(0, end - at) / (7 * DAY)) + 2;
      at = occurrences(row.recurrence, row.starts_at, weeks).find((t) => t >= start && t < end && t < until);
      if (at === undefined) continue;
    } else if (at < start || at >= end) continue;
    const time = new Date(at).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    const video = row.recurrence?.video !== false;
    items.push({
      id: `termin-${row.id}-${at}`,
      kind: "termin",
      title: row.title || "Call",
      text: `Heute ${time} Uhr${video ? " · Call" : ""}`,
      at: new Date(at).toISOString(),
      href: video ? meetUrl(row.code) : "/kalender",
    });
  }
  return items;
}

// ---------- Vorschau ----------

const demoAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** Beispiele für Quellen, die der Vorschau-Speicher nicht kennt */
function demoSources(): Record<"agent" | "aufgaben" | "ideen" | "termine", () => NotificationItem[]> {
  const { date, start, end } = berlinToday();
  const yesterday = berlinDate(Date.now() - DAY);
  return {
    agent: () => [
      { id: "agent-demo-1", kind: "agent", title: "Story: Lieblingsprodukt im Büro", text: "Agent ist fertig, bitte prüfen", at: demoAgo(25), href: "/aufgaben/demo-tp-1" },
      { id: "agent-demo-2", kind: "agent", title: "Auf Content von Creator warten", text: "Agent: Fehler, bitte ansehen", at: demoAgo(60 * 5), href: "/aufgaben/demo-tp-2" },
    ],
    aufgaben: () => [
      taskItem({ id: "demo-task-1", title: "Zugang Meta für Filialleitung", due_on: date }, date),
      taskItem({ id: "demo-task-2", title: "TikTok-Zugang klären", due_on: yesterday }, date),
    ],
    ideen: () => [
      ideaItem("demo-ws-1", "Bäckerei Sonne", [
        { id: "demo-idea-1", created_at: demoAgo(12), title: "Martinsgänse aus Hefeteig" },
        { id: "demo-idea-2", created_at: demoAgo(14), title: "Hinter den Kulissen: 4 Uhr in der Backstube" },
        { id: "demo-idea-3", created_at: demoAgo(15), title: "Adventskalender-Gewinnspiel" },
      ]),
    ],
    termine: () => {
      // Ein Call am späten Nachmittag, sonst eine Stunde ab jetzt
      const later = Math.min(Math.max(start + 16 * 3_600_000, Date.now() + 3_600_000), end - 3_600_000);
      return meetingItems(
        [{ id: "demo-meet-2", code: "pwx-hhab-7rn", title: "Erstgespräch GRID × Meinberg Finance GmbH", starts_at: new Date(later).toISOString(), recurrence: null, valid_until: null, cancelled_at: null }],
        start,
        end
      );
    },
  };
}

// ---------- Route ----------

export const GET = withUser(async (user) => {
  const demo = DEMO ? demoSources() : null;
  const can = (area: string) => hasArea(user.member, area);
  const sources: [string, () => Promise<NotificationItem[]> | NotificationItem[]][] = [];
  if (can("sales")) sources.push(["leads", leads]);
  if (can("finance")) sources.push(["rechnungen", invoices]);
  if (can("personal")) sources.push(["bewerbungen", applications]);
  if (can("aufgaben")) {
    sources.push(["agent", demo?.agent ?? (() => agentTasks(user))]);
    sources.push(["aufgaben", demo?.aufgaben ?? (() => myTasks(user))]);
  }
  if (can("marketing")) sources.push(["vorschlaege", demo?.ideen ?? postIdeas]);
  sources.push(["termine", demo?.termine ?? (() => meetings(user))]);
  // Postingplan unabhängig vom Bereich Marketing: wer zuständig ist, wird erinnert
  sources.push(["postingplan", () => postingPlans(user)]);

  const results = await Promise.all(
    sources.map(async ([name, load]) => {
      try {
        return await load();
      } catch (error) {
        console.error(`Benachrichtigungen (${name}):`, error);
        return [];
      }
    })
  );
  const items = results
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_ITEMS);
  return Response.json({ items });
});
