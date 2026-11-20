import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief, DEFAULT_AUTOPILOT, PROVIDERS, type Autopilot, type IdeaVisual, type MediaItem, type PostIdea, type PostProvider, type SocialPost } from "@/lib/marketing";
import { db, sb } from "../db";
import { renderGraphic } from "./graphic";
import { readMedia, storeMedia } from "./media";
import { archivePostMedia } from "./posts";
import { getBrand, getWorkspace, insertPost, listAccounts, listPosts, listWorkspaces, updateWorkspaceSettings, workspaceLogoPath, workspaceSettings } from "./store";

// Posts vorschlagen: Claude recherchiert mit der Websuche aktuelle Trends,
// Anlässe und News für die Kundenwelt und schlägt daraus Posts in der CI vor.
// Aus einem Vorschlag wird per Klick (oder per Autopilot) ein Post mit
// CI-Grafik im Redaktionskalender – als Entwurf oder fest eingeplant.

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const POST_PROVIDERS: PostProvider[] = ["linkedin", "instagram", "facebook", "tiktok"];

/** Bildformat der Grafik je Plattform */
export const FORMAT: Record<PostProvider, IdeaVisual["format"]> = { linkedin: "4:5", instagram: "4:5", facebook: "4:5", tiktok: "9:16" };

const GUIDE: Record<PostProvider, string> = {
  linkedin: "LinkedIn: 700–1.400 Zeichen, die ersten zwei Zeilen sind der Hook (Neugier, These oder Zahl), kurze Absätze, ein klarer Gedanke, Frage oder Call-to-Action am Ende, 3–5 Hashtags. Kein Link im Text.",
  instagram: "Instagram: 300–900 Zeichen, starker erster Satz, Emojis sparsam, Call-to-Action, 5–10 Hashtags.",
  facebook: "Facebook: 150–500 Zeichen, nahbar, eine Frage an die Community, 0–3 Hashtags.",
  tiktok: "TikTok (Foto-Post): 100–300 Zeichen, locker, Hook in den ersten Worten, 3–6 Hashtags.",
};

// ---------- Speicher ----------

const demoIdeas: PostIdea[] = [];

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function listIdeas(workspaceId: string, limit = 60): Promise<PostIdea[]> {
  if (DEMO) return demoIdeas.filter((i) => i.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  return check(await sb().from("post_ideas").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(limit)) as PostIdea[];
}

export async function getIdea(id: string): Promise<PostIdea | null> {
  if (DEMO) return demoIdeas.find((i) => i.id === id) ?? null;
  return check(await sb().from("post_ideas").select("*").eq("id", id).maybeSingle()) as PostIdea | null;
}

export async function updateIdea(id: string, patch: Partial<Pick<PostIdea, "status" | "title" | "caption" | "hashtags" | "visual" | "post_id">>): Promise<PostIdea> {
  if (DEMO) {
    const idea = demoIdeas.find((i) => i.id === id);
    if (!idea) throw new Error("Vorschlag nicht gefunden");
    return Object.assign(idea, patch);
  }
  return check(await sb().from("post_ideas").update(patch).eq("id", id).select("*").single()) as PostIdea;
}

async function insertIdeas(rows: Omit<PostIdea, "id" | "created_at" | "status" | "post_id">[]): Promise<PostIdea[]> {
  if (!rows.length) return [];
  if (DEMO) {
    const created = rows.map((r) => ({ ...r, id: randomUUID(), created_at: new Date().toISOString(), status: "new" as const, post_id: null }));
    demoIdeas.push(...created);
    return created;
  }
  return check(await sb().from("post_ideas").insert(rows).select("*")) as PostIdea[];
}

// ---------- Recherche ----------

export type ResearchInput = {
  providers: PostProvider[];
  /** Vorschläge je Plattform */
  per_provider: number;
  /** Themen oder Anlass, auf die sich die Recherche konzentriert */
  focus?: string;
  by: string;
};

const RESEARCH_SYSTEM = `Du bist Social-Media-Strategin bei GRID AGENCY, einer Agentur für Social Media und Content. Du recherchierst für eine Kundenwelt, worüber sie in den nächsten Tagen posten sollte.

Vorgehen:
- Nutze die Websuche gezielt: aktuelle Branchen-News, Trends und Debatten auf LinkedIn/Instagram/TikTok, saisonale Anlässe und Aktionstage der nächsten 14 Tage, Neuigkeiten des Kunden selbst (Website, Presse).
- Bevorzuge Themen, die zur Zielgruppe und Tonalität der CI passen und bei denen der Kunde glaubwürdig etwas beitragen kann.
- Keine Themen wiederholen, die in den letzten Posts schon vorkamen.

Antworte mit einem kompakten Dossier auf Deutsch: je Thema 2–4 Sätze (was, warum gerade jetzt, Bezug zum Kunden) und die Quellen-URLs.`;

const IDEAS_SYSTEM = `Du bist Senior Content Creator bei GRID AGENCY. Aus dem Recherche-Dossier schreibst du fertige Social-Media-Posts für einen Kunden.

Regeln:
- Halte dich strikt an die CI-Vorgabe (Tonalität, Ansprache, Dos & Don'ts, Hashtags).
- Jeder Post ist sofort veröffentlichbar: kein Platzhalter, keine eckigen Klammern, keine erfundenen Zahlen, Zitate oder Personen. Fakten nur aus dem Dossier.
- Deutsch, wenn die CI nichts anderes sagt.
- Hashtags gehören in das Feld hashtags, nicht in den Text.
- headline: die Kernaussage für die Grafik, höchstens 60 Zeichen; subline optional, höchstens 90 Zeichen.
- sources: nur URLs aus der gelieferten Quellenliste, die den Post stützen.`;

const IDEAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "title", "trend", "caption", "hashtags", "headline", "subline", "sources"],
        properties: {
          provider: { type: "string", enum: POST_PROVIDERS },
          title: { type: "string", description: "Thema in wenigen Worten" },
          trend: { type: "string", description: "Warum jetzt: Trend, Anlass oder News, 1–2 Sätze" },
          caption: { type: "string", description: "Fertiger Posttext ohne Hashtags" },
          hashtags: { type: "array", items: { type: "string" } },
          headline: { type: "string" },
          subline: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

type RawIdea = { provider: PostProvider; title: string; trend: string; caption: string; hashtags: string[]; headline: string; subline: string; sources: string[] };

const today = () => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

/** Briefing und letzte Posts als Kontext */
async function context(workspaceId: string) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const [brand, posts] = await Promise.all([getBrand(workspaceId), listPosts({ workspace_id: workspaceId, limit: 15 })]);
  const project = workspace.project_id ? await db().get("task_projects", workspace.project_id) : null;
  return {
    workspace,
    brand,
    text: [
      agentBrief(workspace.name, brand),
      "## Briefing",
      String(project?.briefing ?? "(kein Briefing)").slice(0, 8000),
      "## Letzte Posts",
      posts.length ? posts.map((p) => `- ${p.caption.replace(/\s+/g, " ").slice(0, 180)}`).join("\n") : "(noch keine)",
    ].join("\n\n"),
  };
}

function demoIdeasFor(input: ResearchInput): RawIdea[] {
  const topics = [
    ["KI im Alltag des Teams", "Viele Unternehmen testen gerade KI-Assistenten; ehrliche Einblicke kommen gut an.", "Wie wir KI wirklich nutzen"],
    ["Herbst-Saison", "Der Saisonwechsel ist ein natürlicher Anlass für neue Produkte und Geschichten.", "Neue Saison, neue Ideen"],
    ["Hinter den Kulissen", "Behind-the-Scenes-Formate wachsen auf allen Plattformen.", "Ein Tag bei uns"],
  ];
  return input.providers.flatMap((provider) =>
    Array.from({ length: input.per_provider }, (_, i) => {
      const [title, trend, headline] = topics[i % topics.length];
      return {
        provider,
        title,
        trend,
        caption: `${headline}.\n\nDas ist ein Beispieltext aus der Vorschau – live schreibt Claude hier den fertigen ${PROVIDERS[provider].label}-Post nach der CI.\n\nWas meint ihr?`,
        hashtags: ["#gridagency", "#socialmedia"],
        headline,
        subline: "Vorschau ohne Claude-Schlüssel",
        sources: [],
      };
    })
  );
}

/** Trends recherchieren und Vorschläge speichern */
export async function suggestPosts(workspaceId: string, input: ResearchInput): Promise<PostIdea[]> {
  const providers = input.providers.filter((p) => POST_PROVIDERS.includes(p));
  if (!providers.length) throw new Error("Mindestens eine Plattform wählen");
  const perProvider = Math.min(Math.max(Math.round(input.per_provider) || 3, 1), 5);
  const { workspace, text } = await context(workspaceId);

  let raw: RawIdea[];
  let known = new Map<string, string>();
  if (!process.env.ANTHROPIC_API_KEY) {
    if (!DEMO) throw new Error("ANTHROPIC_API_KEY fehlt");
    raw = demoIdeasFor({ ...input, providers, per_provider: perProvider });
  } else {
    // 1. Recherche mit Websuche (läuft serverseitig bei Anthropic)
    const ask = [
      `Heute ist ${today()}.`,
      `Kunde: ${workspace.name}`,
      input.focus?.trim() ? `Fokus der Recherche: ${input.focus.trim().slice(0, 500)}` : "",
      `Plattformen: ${providers.map((p) => PROVIDERS[p].label).join(", ")}. Gesucht sind ${perProvider * providers.length + 2} Themen.`,
      "",
      text,
    ].join("\n");
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: ask }];
    let dossier = "";
    for (let round = 0; round < 4; round++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: RESEARCH_SYSTEM,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "DE", timezone: "Europe/Berlin" } }],
        messages,
      });
      if (response.stop_reason === "refusal") throw new Error("Claude hat die Recherche abgelehnt");
      for (const block of response.content) {
        if (block.type === "text") dossier += block.text;
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const result of block.content) if (result.type === "web_search_result") known.set(result.url, result.title);
        }
      }
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
    }
    known = new Map([...known].slice(0, 60));

    // 2. Fertige Posts als JSON
    const write = [
      text,
      "## Recherche-Dossier",
      dossier.slice(0, 20_000) || "(keine Recherche-Ergebnisse – nutze Briefing und CI)",
      "## Quellenliste",
      [...known].map(([url, title]) => `- ${title}: ${url}`).join("\n") || "(keine)",
      "## Auftrag",
      `Schreibe je Plattform ${perProvider} unterschiedliche Posts: ${providers.map((p) => `${PROVIDERS[p].label} (provider "${p}")`).join(", ")}.`,
      providers.map((p) => GUIDE[p]).join("\n"),
    ].join("\n\n");
    const response = await anthropic().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: IDEAS_SCHEMA } },
      system: IDEAS_SYSTEM,
      messages: [{ role: "user", content: write }],
    });
    const block = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude hat keine Vorschläge geliefert");
    raw = (JSON.parse(block.text) as { ideas: RawIdea[] }).ideas;
  }

  const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
  return insertIdeas(
    raw
      .filter((r) => providers.includes(r.provider) && clean(r.caption, 3000))
      .map((r) => ({
        workspace_id: workspaceId,
        provider: r.provider,
        title: clean(r.title, 160) || "Vorschlag",
        trend: clean(r.trend, 600),
        caption: clean(r.caption, 3000),
        hashtags: (r.hashtags ?? []).map((h) => clean(h, 60).replace(/\s+/g, "")).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 12),
        visual: { headline: clean(r.headline, 90) || clean(r.title, 90), subline: clean(r.subline, 120) || undefined, format: FORMAT[r.provider] },
        sources: (r.sources ?? []).filter((url) => known.has(url)).slice(0, 5).map((url) => ({ url, title: known.get(url) ?? url })),
        created_by: input.by,
      }))
  );
}

// ---------- Grafik und Post ----------

/** Grafik in der CI der Kundenwelt rechnen */
export async function ideaGraphic(workspaceId: string, visual: IdeaVisual, colors: { background?: string; ink?: string; accent?: string } = {}) {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const [brand, logoPath] = await Promise.all([getBrand(workspaceId), workspaceLogoPath(workspaceId)]);
  const logo = logoPath ? await readMedia(logoPath) : null;
  const font = brand.fonts.find((f) => /head|über|titel|display/i.test(f.role))?.family ?? brand.fonts[0]?.family ?? null;
  // Farben aus dem Markenkit (Hintergrund/Primär, Text, Akzent/Sekundär), sonst die der Kundenwelt
  const role = (...roles: string[]) => roles.map((r) => brand.colors.find((c) => c.role === r)?.hex).find(Boolean);
  return renderGraphic({
    name: workspace.name,
    color: colors.background ?? role("Primär", "Hintergrund") ?? workspace.color,
    secondary: colors.accent ?? role("Akzent", "Sekundär") ?? workspace.secondary_color,
    ink: colors.ink,
    logo: logo?.bytes ?? null,
    font,
    visual,
  });
}

// Termine rechnen in Berliner Zeit
const parts = (date: Date) => {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)])
  );
  return { y: values.year, m: values.month, d: values.day, hh: values.hour, mm: values.minute };
};

/** Berliner Ortszeit → Zeitpunkt */
export function berlin(y: number, m: number, d: number, hh: number, mm: number) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = parts(new Date(guess));
  return new Date(guess - (Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - guess));
}

/** Kommende Termine laut Autopilot (Wochentage + Uhrzeit), ab morgen */
function slots(autopilot: Autopilot, days: number) {
  const [hh, mm] = autopilot.time.split(":").map(Number);
  const now = parts(new Date());
  const result: Date[] = [];
  for (let k = 1; k <= days; k++) {
    const day = new Date(Date.UTC(now.y, now.m - 1, now.d + k));
    const weekday = ((day.getUTCDay() + 6) % 7) + 1;
    if (autopilot.weekdays.length && !autopilot.weekdays.includes(weekday)) continue;
    result.push(berlin(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), hh || 9, mm || 0));
  }
  return result;
}

const dayOf = (iso: string) => {
  const p = parts(new Date(iso));
  return `${p.y}-${p.m}-${p.d}`;
};

/** Nächster freier Termin (kein anderer Post an dem Tag) */
export async function nextSlot(workspaceId: string) {
  const autopilot = await getAutopilot(workspaceId);
  const taken = new Set((await listPosts({ workspace_id: workspaceId, limit: 200 })).filter((p) => p.scheduled_at && ["draft", "scheduled"].includes(p.status)).map((p) => dayOf(p.scheduled_at!)));
  const free = slots(autopilot, 60).find((slot) => !taken.has(dayOf(slot.toISOString())));
  return free ?? slots({ ...autopilot, weekdays: [] }, 1)[0];
}

export type IdeaToPost = {
  /** "none": Entwurf ohne Termin, "next": nächster freier Termin, sonst ISO-Zeitpunkt */
  schedule?: "none" | "next" | string;
  /** Grafik in der CI anhängen (Standard: ja) */
  graphic?: boolean;
  /** auto: einplanen (falls Kanäle verbunden), review: Entwurf mit Termin zur Freigabe */
  mode?: "auto" | "review";
  by: string;
};

export type ComposeInput = {
  provider: PostProvider;
  caption: string;
  hashtags?: string[];
  /** Grafik in der CI; null = ohne Grafik */
  visual?: IdeaVisual | null;
  /** Weitere Medien (Storage-Pfade), z. B. ein gerendertes Video */
  media?: MediaItem[];
  title?: string;
};

/** Post für eine Plattform der Kundenwelt anlegen (Grafik, Kanäle, Termin) */
export async function composePost(workspaceId: string, input: ComposeInput, options: IdeaToPost): Promise<SocialPost> {
  const media: MediaItem[] = [...(input.media ?? [])];
  if (input.visual && options.graphic !== false) {
    const image = await ideaGraphic(workspaceId, input.visual);
    media.unshift(await storeMedia(image.bytes, "image/png", input.title ?? input.visual.headline, { width: image.width, height: image.height }));
  }
  const accounts = (await listAccounts(workspaceId)).filter((a) => a.provider === input.provider && a.status === "active");
  const tags = (input.hashtags ?? []).filter((tag) => !input.caption.includes(tag));
  const caption = tags.length ? `${input.caption}\n\n${tags.join(" ")}` : input.caption;
  const when = options.schedule === "next" ? (await nextSlot(workspaceId)).toISOString() : options.schedule && options.schedule !== "none" ? new Date(options.schedule).toISOString() : null;
  const post = await insertPost({
    workspace_id: workspaceId,
    caption,
    media,
    account_ids: accounts.map((a) => a.id),
    scheduled_at: when,
    status: when && accounts.length && options.mode !== "review" ? "scheduled" : "draft",
    created_by: options.by,
  });
  await archivePostMedia(post.id).catch((error) => console.error("SharePoint-Ablage", error));
  return post;
}

/** Aus einem Vorschlag einen Post machen */
export async function ideaToPost(id: string, options: IdeaToPost): Promise<SocialPost> {
  const idea = await getIdea(id);
  if (!idea) throw new Error("Vorschlag nicht gefunden");
  if (idea.post_id) throw new Error("Aus diesem Vorschlag gibt es schon einen Post");
  // Erst sperren, damit ein Doppelklick keinen zweiten Post anlegt
  await updateIdea(id, { status: "used" });
  try {
    const post = await composePost(idea.workspace_id, { provider: idea.provider, caption: idea.caption, hashtags: idea.hashtags, visual: idea.visual, title: idea.title }, options);
    await updateIdea(id, { post_id: post.id });
    return post;
  } catch (error) {
    await updateIdea(id, { status: "new" });
    throw error;
  }
}

// ---------- Autopilot ----------

export async function getAutopilot(workspaceId: string): Promise<Autopilot> {
  const settings = await workspaceSettings(workspaceId);
  return { ...DEFAULT_AUTOPILOT, ...((settings.autopilot as Partial<Autopilot>) ?? {}) };
}

export async function saveAutopilot(workspaceId: string, input: Partial<Autopilot>): Promise<Autopilot> {
  const current = await getAutopilot(workspaceId);
  const next: Autopilot = {
    ...current,
    enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
    providers: Array.isArray(input.providers) ? input.providers.filter((p) => POST_PROVIDERS.includes(p)) : current.providers,
    per_week: input.per_week !== undefined ? Math.min(Math.max(Math.round(Number(input.per_week)) || 1, 1), 7) : current.per_week,
    weekdays: Array.isArray(input.weekdays) ? [...new Set(input.weekdays.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : current.weekdays,
    time: typeof input.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ? input.time : current.time,
    mode: input.mode === "auto" || input.mode === "review" ? input.mode : current.mode,
    agent_calls: typeof input.agent_calls === "boolean" ? input.agent_calls : current.agent_calls,
    focus: typeof input.focus === "string" ? input.focus.slice(0, 1000) : current.focus,
  };
  await updateWorkspaceSettings(workspaceId, { autopilot: next });
  return next;
}

/** Eine Woche vorausplanen: recherchieren, Posts erstellen, Termine verteilen */
export async function runAutopilot(workspaceId: string, by = "autopilot") {
  const autopilot = await getAutopilot(workspaceId);
  if (!autopilot.providers.length) throw new Error("Keine Plattform gewählt");
  await updateWorkspaceSettings(workspaceId, { autopilot: { ...autopilot, last_run: new Date().toISOString(), last_result: "läuft" } });
  try {
    const ideas = await suggestPosts(workspaceId, { providers: autopilot.providers, per_provider: autopilot.per_week, focus: autopilot.focus, by });
    const week = slots(autopilot, 7);
    let created = 0;
    for (const provider of autopilot.providers) {
      const mine = ideas.filter((i) => i.provider === provider).slice(0, autopilot.per_week);
      for (const [index, idea] of mine.entries()) {
        // Mehr Posts als Termine: am selben Tag zwei Stunden später
        const base = week[index % Math.max(week.length, 1)] ?? slots({ ...autopilot, weekdays: [] }, 7)[index % 7];
        const slot = new Date(base.getTime() + Math.floor(index / Math.max(week.length, 1)) * 2 * 3_600_000);
        await ideaToPost(idea.id, { schedule: slot.toISOString(), mode: autopilot.mode, by });
        created++;
      }
    }
    const result = `${created} Posts ${autopilot.mode === "auto" ? "eingeplant" : "zur Freigabe erstellt"}`;
    await updateWorkspaceSettings(workspaceId, { autopilot: { ...(await getAutopilot(workspaceId)), last_result: result } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fehler";
    await updateWorkspaceSettings(workspaceId, { autopilot: { ...(await getAutopilot(workspaceId)), last_result: `Fehler: ${message}` } });
    throw error;
  }
}

/** Für den Cron: höchstens eine fällige Kundenwelt je Aufruf (Zeitlimit) */
export async function autopilotTick() {
  for (const workspace of await listWorkspaces()) {
    const autopilot = await getAutopilot(workspace.id);
    if (!autopilot.enabled) continue;
    const last = autopilot.last_run ? new Date(autopilot.last_run).getTime() : 0;
    if (Date.now() - last < 7 * 86_400_000 - 2 * 3_600_000) continue;
    return { workspace: workspace.name, result: await runAutopilot(workspace.id) };
  }
  return null;
}
