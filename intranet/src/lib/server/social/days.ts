import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief } from "@/lib/marketing";
import { DAY_KIND_LIST, DAY_STATUS_LIST, detectIndustries, INDUSTRIES, isoDay, validDay, type DayKind, type DayStatus, type MarketingDay } from "@/lib/marketing-days";
import { db, sb } from "../db";
import { seedAll } from "./days-seed";
import { getBrand, getWorkspace } from "./store";

// Social-Media-Tage je Kundenwelt: allgemeine Tage (Feiertage, Aktionstage,
// Branchentage; workspace_id null) plus eigene Tage des Kunden. Claude schlägt
// mit der Websuche passende Tage für die nächsten 12 Monate vor (Branche,
// Standort, lokale Events); sie landen als „vorschlag“ im Kalender.

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const cleanNote = (value: unknown) => (typeof value === "string" ? value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000) : "");
/** Titel zum Vergleichen: klein, ohne Satzzeichen und Füllwörter */
const norm = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(der|die|das|des|dem|den|internationaler|internationale|welt|world|national|day|tag)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
const keyOf = (d: Pick<MarketingDay, "date" | "title">) => `${d.date}|${d.title.trim().toLowerCase()}`;
const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDay(d);
};

// ---------- Demo-Speicher ----------

let demoRows: MarketingDay[] | null = null;

function demoStore() {
  if (demoRows) return demoRows;
  const created_at = new Date().toISOString();
  const row = (r: Omit<MarketingDay, "id" | "created_at" | "industries" | "region"> & Partial<Pick<MarketingDay, "industries" | "region">>): MarketingDay => ({
    id: randomUUID(),
    created_at,
    industries: [],
    region: null,
    ...r,
  });
  demoRows = [
    ...seedAll().map((s) => row({ ...s, workspace_id: null, status: "aktiv", source: "system" })),
    row({
      workspace_id: "demo-ws-1",
      date: dayOffset(1),
      title: "Eröffnung Filiale Bornheim",
      kind: "kunde",
      region: "HE",
      note: "Neue Filiale in der Berger Straße.\n\nPost-Idee: Countdown-Story und am Tag selbst ein Reel vom ersten Blech Brezeln.",
      status: "aktiv",
      source: "manuell",
    }),
    row({
      workspace_id: "demo-ws-1",
      date: dayOffset(9),
      title: "Stollen-Anschnitt",
      kind: "kunde",
      note: "Traditioneller Start der Stollensaison in allen Filialen.\n\nPost-Idee: Karussell mit den Stollensorten und der Frage nach dem Lieblingsstollen.",
      status: "vorschlag",
      source: "ki",
    }),
    row({
      workspace_id: "demo-ws-2",
      date: dayOffset(4),
      title: "Pasta-Abend mit Live-Musik",
      kind: "kunde",
      note: "Monatlicher Themenabend im Forno.\n\nPost-Idee: Story-Umfrage, welche Pasta es diesmal geben soll.",
      status: "aktiv",
      source: "manuell",
    }),
  ];
  return demoRows;
}

// ---------- Branche der Kundenwelt ----------

type Profile = { industries: string[]; known: boolean; name: string; city: string; industry: string; website: string; briefing: string };
const profiles = new Map<string, { at: number; profile: Profile }>();

/** Branche, Standort und Briefing der Kundenwelt (5 Minuten gecacht) */
async function profileOf(workspaceId: string): Promise<Profile> {
  const cached = profiles.get(workspaceId);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.profile;
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const [brand, customer, project] = await Promise.all([
    getBrand(workspaceId),
    workspace.customer_id ? db().get("customers", workspace.customer_id).catch(() => null) : null,
    workspace.project_id ? db().get("task_projects", workspace.project_id).catch(() => null) : null,
  ]);
  const industry = clean(customer?.industry, 200);
  const briefing = String(project?.briefing ?? "").slice(0, 8000);
  // Branche erkennen: Branche am Kunden, Name, Zielgruppe/Hinweise der CI, Anfang des Briefings
  const industries = detectIndustries([industry, workspace.name, brand.audience, brand.notes].join(" "));
  const fromBriefing = industries.length ? [] : detectIndustries(briefing.slice(0, 600));
  const profile: Profile = {
    industries: industries.length ? industries : fromBriefing,
    // Branche bekannt (auch wenn nicht Gastro) → Branchentage nur bei Treffer
    known: !!industry || industries.length > 0 || fromBriefing.length > 0,
    name: workspace.name,
    city: clean(customer?.city, 120),
    industry,
    website: clean(customer?.website, 300) || brand.website || "",
    briefing: [agentBrief(workspace.name, brand), "## Briefing", briefing || "(kein Briefing)"].join("\n\n"),
  };
  profiles.set(workspaceId, { at: Date.now(), profile });
  return profile;
}

/** Allgemeiner Branchentag passt zur Kundenwelt? Ohne erkennbare Branche: ja. */
const fits = (day: MarketingDay, profile: Profile) =>
  day.workspace_id !== null || !day.industries?.length || !profile.known || day.industries.some((i) => profile.industries.includes(i));

// ---------- Lesen ----------

/** Alle Zeilen (auch ausgeblendete) einer Kundenwelt im Zeitraum, inkl. allgemeiner Tage */
async function rawDays(workspaceId: string, from: string, to: string): Promise<MarketingDay[]> {
  if (DEMO) return demoStore().filter((d) => (d.workspace_id === null || d.workspace_id === workspaceId) && d.date >= from && d.date <= to);
  if (!UUID.test(workspaceId)) throw new Error("Ungültige Kundenwelt");
  const rows = check(
    await sb().from("marketing_days").select("*").or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`).gte("date", from).lte("date", to).order("date").limit(2000)
  ) as MarketingDay[];
  return rows.map((r) => ({ ...r, industries: r.industries ?? [] }));
}

/** Tage im Kalender: allgemeine (passend zur Branche) + eigene, ohne ausgeblendete.
 * Eine Kundenzeile mit gleichem Datum und Titel überdeckt den allgemeinen Tag. */
export async function listDays(workspaceId: string, from: string, to: string): Promise<MarketingDay[]> {
  if (!validDay(from) || !validDay(to)) throw new Error("Zeitraum ungültig (YYYY-MM-DD)");
  if (to < from) return [];
  const [rows, profile] = await Promise.all([rawDays(workspaceId, from, to), profileOf(workspaceId)]);
  const own = new Set(rows.filter((r) => r.workspace_id).map(keyOf));
  return rows
    .filter((r) => (r.workspace_id || !own.has(keyOf(r))) && r.status !== "ausgeblendet" && fits(r, profile))
    .sort((a, b) => a.date.localeCompare(b.date) || order(a) - order(b) || a.title.localeCompare(b.title, "de"));
}

const order = (d: MarketingDay) => DAY_KIND_LIST.indexOf(d.kind);

export async function getDay(id: string): Promise<MarketingDay | null> {
  if (DEMO) return demoStore().find((d) => d.id === id) ?? null;
  if (!UUID.test(id)) return null;
  return check(await sb().from("marketing_days").select("*").eq("id", id).maybeSingle()) as MarketingDay | null;
}

// ---------- Schreiben ----------

export type DayInput = {
  workspace_id: string;
  date: string;
  title: string;
  kind?: DayKind;
  note?: string;
  region?: string | null;
  status?: DayStatus;
  source?: string;
};

function validate(input: Partial<DayInput>) {
  if (input.date !== undefined && !validDay(input.date)) return "Datum ungültig";
  if (input.title !== undefined && !clean(input.title, 160)) return "Titel fehlt";
  if (input.kind !== undefined && !DAY_KIND_LIST.includes(input.kind)) return "Art ungültig";
  if (input.status !== undefined && !DAY_STATUS_LIST.includes(input.status)) return "Status ungültig";
  return null;
}

async function insertRows(rows: Omit<MarketingDay, "id" | "created_at">[]): Promise<MarketingDay[]> {
  if (!rows.length) return [];
  if (DEMO) {
    const store = demoStore();
    const created = rows
      .filter((r) => !store.some((d) => d.workspace_id === r.workspace_id && keyOf(d) === keyOf(r)))
      .map((r) => ({ ...r, id: randomUUID(), created_at: new Date().toISOString() }));
    store.push(...created);
    return created;
  }
  const { data, error } = await sb().from("marketing_days").insert(rows).select("*");
  if (!error) return data as MarketingDay[];
  if ((error as { code?: string }).code !== "23505") throw new Error(error.message);
  // Ein Treffer im Unique-Index: einzeln einfügen und Dubletten überspringen
  const out: MarketingDay[] = [];
  for (const row of rows) {
    const single = await sb().from("marketing_days").insert(row).select("*").maybeSingle();
    if (single.error && (single.error as { code?: string }).code !== "23505") throw new Error(single.error.message);
    if (single.data) out.push(single.data as MarketingDay);
  }
  return out;
}

/** Eigenen Tag anlegen (Standard: Art „kunde“, aktiv) */
export async function addDay(input: DayInput): Promise<MarketingDay> {
  const invalid = validate(input);
  if (invalid) throw new Error(invalid);
  const title = clean(input.title, 160);
  const existing = await rawDays(input.workspace_id, input.date, input.date);
  const same = existing.find((d) => d.workspace_id === input.workspace_id && keyOf(d) === keyOf({ date: input.date, title }));
  // Überdeckende (ausgeblendete) Zeile wieder aktivieren statt Dublette
  if (same && same.status !== "ausgeblendet") throw new Error("Diesen Tag gibt es schon im Kalender");
  if (same) return updateDay(same.id, { status: input.status ?? "aktiv", note: input.note ?? same.note });
  if (existing.some((d) => d.workspace_id === null && keyOf(d) === keyOf({ date: input.date, title }) && d.status === "aktiv")) {
    throw new Error("Diesen Tag gibt es schon im Kalender");
  }
  const [created] = await insertRows([
    {
      workspace_id: input.workspace_id,
      date: input.date,
      title,
      kind: input.kind ?? "kunde",
      region: clean(input.region, 10) || null,
      note: cleanNote(input.note),
      status: input.status ?? "aktiv",
      source: clean(input.source, 30) || "manuell",
      industries: [],
    },
  ]);
  if (!created) throw new Error("Diesen Tag gibt es schon im Kalender");
  return created;
}

export type DayPatch = Partial<Pick<MarketingDay, "status" | "title" | "note" | "date" | "kind">>;

/** Tag ändern. Allgemeine Tage (workspace_id null) lassen sich nur je Kundenwelt
 * ein- und ausblenden: dafür entsteht eine überdeckende Kundenzeile. */
export async function updateDay(id: string, patch: DayPatch, workspaceId?: string): Promise<MarketingDay> {
  const day = await getDay(id);
  if (!day) throw new Error("Tag nicht gefunden");
  const invalid = validate(patch);
  if (invalid) throw new Error(invalid);

  if (day.workspace_id === null) {
    const other = Object.keys(patch).filter((k) => k !== "status");
    if (!workspaceId || other.length || !patch.status) throw new Error("Allgemeine Tage lassen sich nur je Kunde ausblenden");
    const shadow = (await rawDays(workspaceId, day.date, day.date)).find((d) => d.workspace_id === workspaceId && keyOf(d) === keyOf(day));
    if (patch.status !== "ausgeblendet") {
      if (shadow) await removeDay(shadow.id);
      return { ...day };
    }
    if (shadow) return updateDay(shadow.id, { status: "ausgeblendet" });
    const [created] = await insertRows([
      { workspace_id: workspaceId, date: day.date, title: day.title, kind: day.kind, region: day.region, note: day.note, status: "ausgeblendet", source: "ausgeblendet", industries: [] },
    ]);
    return created ?? { ...day, status: "ausgeblendet" };
  }

  const next: DayPatch = {};
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.title !== undefined) next.title = clean(patch.title, 160);
  if (patch.note !== undefined) next.note = cleanNote(patch.note);
  if (patch.date !== undefined) next.date = patch.date;
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (DEMO) {
    const store = demoStore();
    if ((next.title || next.date) && store.some((d) => d.id !== id && d.workspace_id === day.workspace_id && keyOf(d) === keyOf({ date: next.date ?? day.date, title: next.title ?? day.title }))) {
      throw new Error("Diesen Tag gibt es schon im Kalender");
    }
    return Object.assign(store.find((d) => d.id === id)!, next);
  }
  const { data, error } = await sb().from("marketing_days").update(next).eq("id", id).select("*").single();
  if (error) throw new Error((error as { code?: string }).code === "23505" ? "Diesen Tag gibt es schon im Kalender" : error.message);
  return data as MarketingDay;
}

/** Eigenen Tag löschen (allgemeine Tage nicht) */
export async function removeDay(id: string) {
  const day = await getDay(id);
  if (!day) throw new Error("Tag nicht gefunden");
  if (day.workspace_id === null) throw new Error("Allgemeine Tage lassen sich nur je Kunde ausblenden");
  if (DEMO) {
    const store = demoStore();
    store.splice(store.indexOf(day), 1);
    return;
  }
  check(await sb().from("marketing_days").delete().eq("id", id));
}

// ---------- KI-Vorschläge ----------

type RawDay = { date: string; title: string; kind: "branche" | "kunde"; why: string; idea: string };

const RESEARCH_SYSTEM = `Du bist Social-Media-Strategin bei GRID AGENCY, einer Agentur für Social Media und Content. Du baust für einen Kunden einen Kalender mit Social-Media-Anlässen für die nächsten 12 Monate.

Vorgehen:
- Nutze die Websuche gezielt: Aktionstage und „Tag des …“ der Branche (international und in Deutschland), Messen und Branchenevents, Feste, Märkte und Events in der Stadt oder Region des Kunden (mit genauem Datum für das kommende Jahr), Jubiläen oder Termine des Kunden selbst (Website, Presse).
- Nur Tage mit verlässlichem Datum. Termine ohne bestätigtes Datum für das kommende Jahr weglassen.
- Allgemeine Feiertage und große Anlässe (Weihnachten, Ostern, Muttertag, Black Friday, Halloween …) stehen schon im Kalender: nicht vorschlagen.
- Bevorzuge Anlässe, zu denen der Kunde glaubwürdig etwas posten kann.

Antworte mit einer kompakten Liste auf Deutsch: je Tag Datum (YYYY-MM-DD), Name, warum relevant für den Kunden, Quelle.`;

const DAYS_SYSTEM = `Du bist Senior Content Strategist bei GRID AGENCY. Aus der Recherche erstellst du die Liste der Social-Media-Tage für den Kunden.

Regeln:
- 15 bis 30 Tage, verteilt über die nächsten 12 Monate, keine Dubletten und nichts aus der Liste „Schon im Kalender“.
- date: YYYY-MM-DD, nur Daten aus der Recherche oder feste Kalendertage (z. B. Tag des Croissants am 30. Januar). Keine erfundenen Termine.
- kind: "branche" für Aktionstage der Branche, "kunde" für lokale Events in Stadt/Region und Termine des Kunden selbst.
- title: kurzer deutscher Name, höchstens 60 Zeichen (z. B. „Tag des Croissants“).
- why: ein Satz, warum der Tag für diesen Kunden relevant ist.
- idea: eine konkrete Post-Idee in einem Satz, passend zur CI.`;

const DAYS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["days"],
  properties: {
    days: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "title", "kind", "why", "idea"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          title: { type: "string" },
          kind: { type: "string", enum: ["branche", "kunde"] },
          why: { type: "string" },
          idea: { type: "string" },
        },
      },
    },
  },
} as const;

const todayText = () => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

/** Nächster Termin eines festen Kalendertags (MM-DD) ab heute */
function next(monthDay: string) {
  const year = new Date().getFullYear();
  const candidate = `${year}-${monthDay}`;
  return candidate >= isoDay(new Date()) ? candidate : `${year + 1}-${monthDay}`;
}

/** Feste Vorschläge für die Vorschau ohne Claude-Schlüssel */
function demoSuggestions(profile: Profile): RawDay[] {
  const bakery: [string, string, string, string][] = [
    ["01-30", "Tag des Croissants", "Das Croissant ist ein Klassiker der Theke.", "Reel: Croissant-Laminieren in der Backstube im Zeitraffer."],
    ["03-21", "Tag der Waffel", "Waffeln passen zum Café-Angebot am Wochenende.", "Story-Umfrage: Puderzucker oder Sahne?"],
    ["04-26", "Tag der Brezel", "Brezeln sind ein Bestseller.", "Video: So wird eine Brezel geschlungen, mit Mitmach-Frage."],
    ["05-05", "Tag des Deutschen Brotes", "Brotkultur ist das Kernthema einer Bäckerei.", "Karussell mit den fünf beliebtesten Brotsorten des Hauses."],
    ["06-01", "Weltmilchtag", "Regionale Milch steckt in vielen Backwaren.", "Post über den Milchlieferanten aus der Region."],
    ["09-29", "Tag des Butterkuchens", "Butterkuchen ist ein Blechkuchen-Klassiker.", "Foto vom frischen Blech mit Rezept-Hinweis."],
    ["10-01", "Tag des Kaffees", "Kaffee zum Frühstück ist Teil des Angebots.", "Aktion: Zu jedem Croissant ein Kaffee zum halben Preis."],
    ["10-16", "Welttag des Brotes", "Weltbrottag rückt das Brot-Handwerk in den Fokus.", "Reel: Ein Tag mit dem Sauerteig."],
    ["12-04", "Tag der Plätzchen", "Weihnachtsgebäck ist das Saisongeschäft.", "Gewinnspiel: Lieblingsplätzchen kommentieren."],
  ];
  const pizza: [string, string, string, string][] = [
    ["01-17", "Tag der italienischen Küche", "Italienische Küche ist das Kernthema.", "Karussell mit den Klassikern der Karte."],
    ["02-09", "Tag der Pizza", "World Pizza Day ist der wichtigste Tag für eine Pizzeria.", "Abstimmung über die Pizza des Monats."],
    ["03-21", "Tag des Tiramisu", "Tiramisu ist das beliebteste Dessert.", "Video: Tiramisu-Schichten in 15 Sekunden."],
    ["05-26", "Tag der Pasta Carbonara", "Carbonara Day wird in Italien groß gefeiert.", "Reel: Echte Carbonara ohne Sahne."],
    ["10-25", "Weltnudeltag", "World Pasta Day passt zur Pastakarte.", "Story: Welche Pastaform seid ihr?"],
  ];
  const general: [string, string, string, string][] = [
    ["01-28", "Tag des Datenschutzes", "Vertrauen ist für jede Marke ein Thema.", "Kurzer Tipp, wie ihr mit Kundendaten umgeht."],
    ["03-14", "Pi-Tag", "Ein Zahlenspiel für lockere Posts.", "Quiz-Post mit einer Zahl aus dem Unternehmen."],
    ["06-21", "Fête de la Musique", "Musik und Stadtfeste ziehen Reichweite.", "Team-Playlist teilen."],
    ["09-27", "Welttourismustag", "Gäste und Region vorstellen.", "Lieblingsorte des Teams in der Stadt."],
  ];
  const list = profile.industries.includes("pizza") || profile.industries.includes("restaurant") ? pizza : profile.industries.length ? bakery : general;
  const city = profile.city || (/frankfurt/i.test(profile.briefing) ? "Frankfurt" : "");
  const local: RawDay[] = city
    ? [
        { date: next("11-23"), title: `Weihnachtsmarkt ${city}`, kind: "kunde", why: `Lokaler Anlass in ${city}, viel Laufkundschaft.`, idea: "Story vom Weg zum Weihnachtsmarkt mit Hinweis auf die nächste Filiale." },
        { date: next("06-13"), title: `Stadtfest ${city}`, kind: "kunde", why: "Lokales Event mit hoher Reichweite.", idea: "Behind the Scenes vom Stand oder Sonderöffnungszeiten." },
      ]
    : [];
  return [...list.map(([md, title, why, idea]) => ({ date: next(md), title, kind: "branche" as const, why: `${why} (Vorschau ohne Claude)`, idea })), ...local];
}

/** Claude recherchiert passende Tage für die nächsten 12 Monate und speichert sie als Vorschlag */
export async function suggestDays(workspaceId: string): Promise<MarketingDay[]> {
  const profile = await profileOf(workspaceId);
  const from = isoDay(new Date());
  const until = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return isoDay(d);
  })();
  const existing = await rawDays(workspaceId, from, until);

  let raw: RawDay[];
  if (!process.env.ANTHROPIC_API_KEY) {
    if (!DEMO) throw new Error("ANTHROPIC_API_KEY fehlt");
    raw = demoSuggestions(profile);
  } else {
    const known = existing.filter((d) => fits(d, profile)).map((d) => `- ${d.date} ${d.title}`);
    const about = [
      `Heute ist ${todayText()}. Zeitraum: ${from} bis ${until}.`,
      `Kunde: ${profile.name}`,
      profile.industry && `Branche: ${profile.industry}`,
      profile.industries.length && `Erkannte Branche: ${profile.industries.map((i) => INDUSTRIES[i]?.label ?? i).join(", ")}`,
      profile.city && `Standort: ${profile.city}`,
      profile.website && `Website: ${profile.website}`,
    ]
      .filter(Boolean)
      .join("\n");

    // 1. Recherche mit Websuche
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: [about, "Gesucht sind 25–35 Kandidaten.", profile.briefing].join("\n\n") }];
    let dossier = "";
    for (let round = 0; round < 4; round++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: RESEARCH_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "DE", timezone: "Europe/Berlin", ...(profile.city ? { city: profile.city } : {}) } }],
        messages,
      });
      if (response.stop_reason === "refusal") throw new Error("Claude hat die Recherche abgelehnt");
      for (const block of response.content) if (block.type === "text") dossier += block.text;
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
    }

    // 2. Liste als JSON
    const write = [
      about,
      profile.briefing,
      "## Recherche",
      dossier.slice(0, 20_000) || "(keine Recherche-Ergebnisse – nutze feste Branchentage und das Briefing)",
      "## Schon im Kalender (nicht vorschlagen)",
      known.join("\n").slice(0, 8000) || "(nichts)",
    ].join("\n\n");
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: DAYS_SCHEMA } },
      system: DAYS_SYSTEM,
      messages: [{ role: "user", content: write }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude hat keine Tage geliefert");
    raw = (JSON.parse(block.text) as { days: RawDay[] }).days ?? [];
  }

  // Dubletten: gleicher Tag mit ähnlichem Titel oder gleicher Titel im Zeitraum
  const seen = existing.map((d) => ({ date: d.date, norm: norm(d.title) }));
  const dupe = (date: string, n: string) => !n || seen.some((s) => s.norm === n || (s.date === date && !!s.norm && (s.norm.includes(n) || n.includes(s.norm))));
  const rows: Omit<MarketingDay, "id" | "created_at">[] = [];
  for (const r of raw) {
    const title = clean(r.title, 80);
    const n = norm(title);
    if (!title || !validDay(r.date) || r.date < from || r.date > until || dupe(r.date, n)) continue;
    seen.push({ date: r.date, norm: n });
    const why = clean(r.why, 400);
    const idea = clean(r.idea, 400);
    rows.push({
      workspace_id: workspaceId,
      date: r.date,
      title,
      kind: r.kind === "kunde" ? "kunde" : "branche",
      region: null,
      note: [why, idea && `Post-Idee: ${idea}`].filter(Boolean).join("\n\n"),
      status: "vorschlag",
      source: "ki",
      industries: [],
    });
    if (rows.length >= 30) break;
  }
  return (await insertRows(rows)).sort((a, b) => a.date.localeCompare(b.date));
}
