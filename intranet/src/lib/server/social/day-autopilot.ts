import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief, POST_FORMATS, STORY_PROVIDERS, type IdeaVisual, type MediaItem, type PostFormat, type PostProvider, type ReviewNote, type SocialPost } from "@/lib/marketing";
import { DAY_KINDS, isoDay, type MarketingDay } from "@/lib/marketing-days";
import { designFromVisual, palette, type Colors } from "./ai-design";
import { canvaStyle, recentCaptions, styleBrief, styleImages } from "./brand-style";
import { getDay, listDays } from "./days";
import { berlin } from "./ideas";
import { archivePostMedia } from "./posts";
import { getBrand, getPost, getWorkspace, insertPost, listAccounts, listPosts, listWorkspaces, updatePost, updateWorkspaceSettings, workspaceSettings } from "./store";

// Tage-Autopilot: Rund zwei Wochen vor einem passenden Social-Media-Tag
// (Muttertag, Tag des Croissants, Kunden-Jubiläum …) legt der Hub je Kunde
// Entwürfe an: einen Post (Einzelbild oder Karussell, je nach Thema) und eine
// Story. Claude schreibt Caption und Grafiktexte in der CI und im Stil der
// bisherigen Beiträge, die Grafiken landen als bearbeitbare Designs im
// Kundenordner in Canva. Die Entwürfe stehen mit Termin im Planer; das Team
// gibt sie frei oder schreibt einen Änderungswunsch, den Claude umsetzt.

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export const BY = "tage-agent";

export type DayAutopilot = {
  enabled: boolean;
  /** So viele Tage vorher entstehen die Entwürfe */
  lead_days: number;
  post: boolean;
  /** Bei passendem Thema darf der Post ein Karussell werden */
  carousel: boolean;
  story: boolean;
  /** erledigte Aufträge „<day_id>:<post|story>“ (auch übersprungene) */
  done: string[];
  /** Fehlversuche je Auftrag; nach drei Versuchen wird er übersprungen */
  failed?: Record<string, number>;
};

export const DEFAULT_DAY_AUTOPILOT: DayAutopilot = { enabled: true, lead_days: 14, post: true, carousel: true, story: true, done: [] };

type Slot = "post" | "story";

export async function getDayAutopilot(workspaceId: string): Promise<DayAutopilot> {
  const saved = (await workspaceSettings(workspaceId)).day_autopilot as Partial<DayAutopilot> | undefined;
  return { ...DEFAULT_DAY_AUTOPILOT, ...(saved ?? {}), done: Array.isArray(saved?.done) ? saved.done : [] };
}

export async function saveDayAutopilot(workspaceId: string, input: Partial<DayAutopilot>): Promise<DayAutopilot> {
  const current = await getDayAutopilot(workspaceId);
  const flag = (key: "enabled" | "post" | "carousel" | "story") => (typeof input[key] === "boolean" ? input[key] : current[key]);
  const next: DayAutopilot = {
    ...current,
    enabled: flag("enabled"),
    post: flag("post"),
    carousel: flag("carousel"),
    story: flag("story"),
    lead_days: input.lead_days !== undefined ? Math.min(Math.max(Math.round(Number(input.lead_days)) || 14, 3), 45) : current.lead_days,
  };
  await updateWorkspaceSettings(workspaceId, { day_autopilot: next });
  return next;
}

async function markDone(workspaceId: string, keys: string[]) {
  const current = await getDayAutopilot(workspaceId);
  // Nur die letzten 400 Aufträge merken (reicht für über ein Jahr)
  const done = [...new Set([...current.done, ...keys])].slice(-400);
  await updateWorkspaceSettings(workspaceId, { day_autopilot: { ...current, done } });
}

// ---------- Claude ----------

const SLIDE = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "subline"],
  properties: {
    headline: { type: "string", description: "Text auf der Grafik, höchstens 60 Zeichen, ohne Hashtags" },
    subline: { type: "string", description: "Zweite Zeile, höchstens 90 Zeichen, leer wenn unnötig" },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["relevant", "reason", "format", "caption", "hashtags", "slides", "background", "text_color", "accent"],
  properties: {
    relevant: { type: "boolean", description: "Passt der Tag zum Kunden (Marke, Branche, Zielgruppe)? Nur false, wenn ein Post dazu unpassend oder peinlich wäre." },
    reason: { type: "string", description: "Ein Satz: warum (nicht) passend bzw. was die Idee ist" },
    format: { type: "string", enum: ["feed", "carousel", "story"], description: "story bei Story; sonst feed (ein Bild) oder carousel (3–5 Slides, wenn das Thema mehrere Punkte hat)" },
    caption: { type: "string", description: "Caption mit Emojis passend zur CI, ohne Hashtags. Bei Story: kurzer interner Hinweis, was die Story zeigt." },
    hashtags: { type: "array", items: { type: "string" }, description: "Bei Posts 3–5 passende Hashtags (inkl. Marken-Hashtags der CI), bei Storys leer" },
    slides: { type: "array", items: SLIDE, description: "Grafiken: feed und story genau 1, carousel 3–5 (erste Slide = Aufhänger, letzte = Abschluss/Call-to-Action)" },
    background: { type: "string", description: "Hintergrundfarbe als Hex aus der CI-Palette" },
    text_color: { type: "string", description: "Textfarbe als Hex aus der CI-Palette, gut lesbar" },
    accent: { type: "string", description: "Akzentfarbe als Hex aus der CI-Palette" },
  },
} as const;

const SYSTEM = `Du bist Senior Content Creator und Art Director bei GRID AGENCY. Zu einem Social-Media-Tag (Feiertag, Aktionstag, Branchentag oder Tag des Kunden) erstellst du einen fertigen Entwurf für einen Kunden.

Regeln:
- Erst prüfen, ob der Tag zur Marke passt. Bei unpassenden Tagen relevant = false (dann reichen kurze Felder).
- Strikt in der CI des Kunden: Tonalität, Zielgruppe, Dos & Don'ts, Marken-Hashtags.
- Am Stil der bisherigen Beiträge und der angehängten bestehenden Designs orientieren (Länge, Ansprache, Emojis, Text auf Grafiken), aber nichts kopieren.
- Keine erfundenen Preise, Rabatte, Öffnungszeiten oder Aktionen; Angebote nur, wenn sie im Briefing stehen. Stattdessen Haltung, Produkt, Handwerk, Community.
- Farben nur aus der CI-Palette; der Text muss gut lesbar sein.
- Sprache Deutsch (außer die CI sagt etwas anderes).`;

type Draft = { relevant: boolean; reason: string; format: PostFormat; caption: string; hashtags: string[]; slides: { headline: string; subline: string }[]; colors: Colors };

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

function dayLine(day: MarketingDay) {
  const date = new Date(`${day.date}T12:00:00`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `## Anlass\n${day.title} – ${date} (${DAY_KINDS[day.kind].label})${day.note ? `\nHinweis: ${day.note}` : ""}`;
}

async function draftFor(workspaceId: string, day: MarketingDay, slot: Slot, settings: DayAutopilot, extra?: { current: SocialPost; slides: { headline: string; subline: string }[]; feedback: string }): Promise<Draft> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  if (DEMO) {
    const slides = slot === "story" ? [{ headline: day.title, subline: "Heute bei uns" }] : settings.carousel ? [{ headline: day.title, subline: "" }, { headline: "Darum feiern wir mit", subline: "" }, { headline: "Kommt vorbei", subline: workspace.name }] : [{ headline: day.title, subline: "" }];
    return { relevant: true, reason: "Vorschau", format: slot === "story" ? "story" : slides.length > 1 ? "carousel" : "feed", caption: extra ? `${extra.current.caption}\n\n(überarbeitet: ${extra.feedback})` : `Heute ist ${day.title}! 🎉 Wir feiern mit – und ihr?`, hashtags: [], slides, colors: {} };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Claude ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)");
  const [brand, style, history] = await Promise.all([getBrand(workspaceId), canvaStyle(workspaceId).catch(() => null), recentCaptions(workspaceId)]);
  const colors = palette(brand, style);
  const images = await styleImages(style);
  const task =
    slot === "story"
      ? "## Aufgabe\nEine Story (9:16, format story, genau 1 Slide) zum Anlass. Kurz, plakativ, gern als Teaser auf den Post."
      : `## Aufgabe\nEin Feed-Post (4:5) zum Anlass.${settings.carousel ? " Wenn das Thema mehrere Punkte hergibt (Tipps, Rezept, Geschichte, Produkte), als Karussell mit 3–5 Slides, sonst ein Einzelbild." : " Nur ein Einzelbild (format feed)."}`;
  const revision = extra
    ? [
        "## Bisheriger Entwurf",
        `Caption:\n${extra.current.caption}`,
        `Grafiktexte:\n${extra.slides.map((s, i) => `${i + 1}. ${s.headline}${s.subline ? ` / ${s.subline}` : ""}`).join("\n") || "(unbekannt)"}`,
        `## Änderungswunsch des Teams (umsetzen, Rest möglichst beibehalten)\n${extra.feedback}`,
        "relevant ist hier immer true.",
      ].join("\n\n")
    : "";
  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          ...images,
          {
            type: "text",
            text: [
              agentBrief(workspace.name, brand),
              colors.length ? `## CI-Palette (nur diese Farben)\n${colors.map((c) => `- ${c.role}: ${c.hex}`).join("\n")}` : `## CI-Palette\n- Primär: ${workspace.color}`,
              styleBrief(style),
              history,
              dayLine(day),
              task,
              revision,
            ]
              .filter(Boolean)
              .join("\n\n"),
          },
        ],
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude hat keinen Entwurf geliefert");
  const raw = JSON.parse(block.text) as { relevant?: boolean; reason?: string; format?: string; caption?: string; hashtags?: string[]; slides?: { headline?: string; subline?: string }[]; background?: string; text_color?: string; accent?: string };

  const HEX = /^#[0-9a-f]{6}$/i;
  const allowed = new Set([...colors.map((c) => c.hex.toLowerCase()), workspace.color.toLowerCase(), (workspace.secondary_color ?? "").toLowerCase(), "#ffffff", "#000000"]);
  const pick = (v?: string) => (v && HEX.test(v.trim()) && allowed.has(v.trim().toLowerCase()) ? v.trim() : undefined);
  const format: PostFormat = slot === "story" ? "story" : raw.format === "carousel" && settings.carousel ? "carousel" : extra?.current.format === "carousel" && settings.carousel ? "carousel" : "feed";
  let slides = (raw.slides ?? []).map((s) => ({ headline: clip(s.headline, 70), subline: clip(s.subline, 100) })).filter((s) => s.headline);
  if (!slides.length) slides = [{ headline: day.title, subline: "" }];
  slides = format === "carousel" ? slides.slice(0, 5) : slides.slice(0, 1);
  const hashtags = slot === "story" ? [] : [...new Set((raw.hashtags ?? []).map((h) => `#${String(h).replace(/^#/, "").replace(/\s+/g, "")}`).filter((h) => h.length > 1))].slice(0, 5);
  const caption = [String(raw.caption ?? "").trim().slice(0, 2000), hashtags.join(" ")].filter(Boolean).join("\n\n");
  return { relevant: extra ? true : raw.relevant !== false, reason: clip(raw.reason, 300), format: format === "carousel" && slides.length < 2 ? "feed" : format, caption, hashtags, slides, colors: { background: pick(raw.background), ink: pick(raw.text_color), accent: pick(raw.accent) } };
}

/** Grafiken als Canva-Designs im Kundenordner anlegen */
async function designsFor(workspaceId: string, workspaceName: string, day: MarketingDay, draft: Draft): Promise<MediaItem[]> {
  const ratio: IdeaVisual["format"] = draft.format === "story" ? "9:16" : "4:5";
  const label = POST_FORMATS[draft.format].label;
  const media: MediaItem[] = [];
  for (const [index, slide] of draft.slides.entries()) {
    const name = `${day.title} · ${label}${draft.slides.length > 1 ? ` ${index + 1}/${draft.slides.length}` : ""} · ${workspaceName}`;
    const { item } = await designFromVisual(workspaceId, { headline: slide.headline, subline: slide.subline || undefined, format: ratio }, draft.colors, name);
    media.push(item);
  }
  return media;
}

/** Termin: Story morgens, Post zur Autopilot-Zeit bzw. mittags */
function when(day: MarketingDay, slot: Slot) {
  const [y, m, d] = day.date.split("-").map(Number);
  return slot === "story" ? berlin(y, m, d, 8, 30) : berlin(y, m, d, 11, 30);
}

async function channelsFor(workspaceId: string, slot: Slot) {
  const accounts = (await listAccounts(workspaceId)).filter((a) => a.status === "active" && a.provider !== "canva");
  const allowed: PostProvider[] = slot === "story" ? STORY_PROVIDERS : ["instagram", "facebook", "linkedin", "tiktok"];
  return accounts.filter((a) => allowed.includes(a.provider as PostProvider)).map((a) => a.id);
}

export type DayJobResult = { day: string; slot: Slot; status: "erstellt" | "übersprungen" | "vorhanden" | "fehler"; post_id?: string; note?: string };

/** Einen Entwurf (Post oder Story) zu einem Tag anlegen */
export async function createDayDraft(workspaceId: string, day: MarketingDay, slot: Slot, settings?: DayAutopilot): Promise<DayJobResult> {
  const config = settings ?? (await getDayAutopilot(workspaceId));
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const existing = (await listPosts({ workspace_id: workspaceId, limit: 300 })).find((p) => p.day_id === day.id && (slot === "story" ? p.format === "story" : p.format !== "story"));
  if (existing) return { day: day.title, slot, status: "vorhanden", post_id: existing.id };

  const draft = await draftFor(workspaceId, day, slot, config);
  if (!draft.relevant) return { day: day.title, slot, status: "übersprungen", note: draft.reason };
  const media = await designsFor(workspaceId, workspace.name, day, draft);
  const post = await insertPost({
    workspace_id: workspaceId,
    caption: draft.caption,
    media,
    account_ids: await channelsFor(workspaceId, slot),
    scheduled_at: when(day, slot).toISOString(),
    status: "draft",
    created_by: BY,
    format: draft.format,
    day_id: day.id,
  });
  const note: ReviewNote = { at: new Date().toISOString(), by: "Agent", kind: "agent", text: draft.reason || `Entwurf zu ${day.title}`, slides: draft.slides };
  await updatePost(post.id, { review: [note] });
  await archivePostMedia(post.id).catch((error) => console.error("SharePoint-Ablage", error));
  return { day: day.title, slot, status: "erstellt", post_id: post.id };
}

/** Beide Entwürfe zu einem Tag sofort anlegen (Knopf im Planer) */
export async function draftsForDay(workspaceId: string, dayId: string): Promise<DayJobResult[]> {
  const day = await getDay(dayId);
  if (!day || (day.workspace_id && day.workspace_id !== workspaceId)) throw new Error("Tag nicht gefunden");
  const settings = await getDayAutopilot(workspaceId);
  const slots: Slot[] = [...(settings.post ? (["post"] as const) : []), ...(settings.story ? (["story"] as const) : [])];
  if (!slots.length) slots.push("post");
  const results: DayJobResult[] = [];
  for (const slot of slots) {
    const result = await createDayDraft(workspaceId, day, slot, settings);
    results.push(result);
    // Passt der Tag nicht, braucht es auch keine Story
    if (result.status === "übersprungen") break;
  }
  await markDone(workspaceId, slots.map((s) => `${day.id}:${s}`));
  return results;
}

/** Änderungswunsch umsetzen: Caption und Grafiken neu, Verlauf am Post */
export async function revisePost(postId: string, feedback: string, by: string): Promise<SocialPost> {
  const post = await getPost(postId);
  if (!post) throw new Error("Post nicht gefunden");
  if (!["draft", "scheduled", "failed"].includes(post.status)) throw new Error("Veröffentlichte Posts lassen sich nicht mehr ändern");
  const text = feedback.trim().slice(0, 1500);
  if (!text) throw new Error("Bitte beschreiben, was geändert werden soll");
  const workspace = await getWorkspace(post.workspace_id);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const day: MarketingDay =
    (post.day_id ? await getDay(post.day_id) : null) ??
    ({ id: "", workspace_id: post.workspace_id, date: isoDay(new Date(post.scheduled_at ?? Date.now())), title: "Post", kind: "kunde", region: null, note: "", status: "aktiv", industries: [], source: "manuell", created_at: post.created_at } as MarketingDay);
  const lastSlides = [...(post.review ?? [])].reverse().find((n) => n.slides?.length)?.slides ?? [];
  const settings = await getDayAutopilot(post.workspace_id);
  const slot: Slot = post.format === "story" ? "story" : "post";
  const draft = await draftFor(post.workspace_id, day, slot, settings, { current: post, slides: lastSlides, feedback: text });
  const media = await designsFor(post.workspace_id, workspace.name, day, draft);
  const now = new Date().toISOString();
  const review: ReviewNote[] = [...(post.review ?? []), { at: now, by, kind: "wunsch", text }, { at: now, by: "Agent", kind: "agent", text: draft.reason || "Überarbeitet", slides: draft.slides }];
  const saved = await updatePost(post.id, { caption: draft.caption, media, format: draft.format, review, status: "draft" });
  await archivePostMedia(post.id).catch((error) => console.error("SharePoint-Ablage", error));
  return saved;
}

// ---------- Cron ----------

/** Stündlich: fällige Tage aller Kundenwelten abarbeiten, solange Zeit ist */
export async function dayAutopilotTick(budgetMs = 200_000) {
  const start = Date.now();
  const results: (DayJobResult & { workspace: string })[] = [];
  const from = isoDay(new Date(Date.now() + 86_400_000));
  for (const workspace of await listWorkspaces()) {
    if (workspace.planning === false) continue;
    const settings = await getDayAutopilot(workspace.id);
    if (!settings.enabled || (!settings.post && !settings.story)) continue;
    const to = isoDay(new Date(Date.now() + settings.lead_days * 86_400_000));
    const days = (await listDays(workspace.id, from, to)).filter((d) => d.status === "aktiv");
    for (const day of days) {
      const slots: Slot[] = [...(settings.post ? (["post"] as const) : []), ...(settings.story ? (["story"] as const) : [])].filter((s) => !settings.done.includes(`${day.id}:${s}`));
      for (const slot of slots) {
        // Neuen Auftrag nur starten, wenn noch genug Zeit bleibt (Canva + Claude ≈ 1–2 Minuten)
        if (Date.now() - start > budgetMs - 110_000) return results;
        try {
          const result = await createDayDraft(workspace.id, day, slot, settings);
          results.push({ ...result, workspace: workspace.name });
          const keys = result.status === "übersprungen" ? [`${day.id}:post`, `${day.id}:story`] : [`${day.id}:${slot}`];
          await markDone(workspace.id, keys);
          settings.done.push(...keys);
          if (result.status === "übersprungen") break;
        } catch (error) {
          // Nächste Stunde erneut versuchen, nach drei Fehlschlägen aufgeben
          const key = `${day.id}:${slot}`;
          const current = await getDayAutopilot(workspace.id);
          const failed = { ...(current.failed ?? {}), [key]: (current.failed?.[key] ?? 0) + 1 };
          await updateWorkspaceSettings(workspace.id, { day_autopilot: { ...current, failed } });
          if (failed[key] >= 3) await markDone(workspace.id, [key]);
          results.push({ day: day.title, slot, status: "fehler", note: error instanceof Error ? error.message : "Fehler", workspace: workspace.name });
          console.error("Tage-Autopilot", workspace.name, day.title, error);
        }
      }
    }
  }
  return results;
}
