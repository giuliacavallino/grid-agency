import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief, type IdeaVisual, type MediaItem } from "@/lib/marketing";
import { canvaAccount, createDesign, demoEditUrl, exportDesign, uploadAsset } from "./canva";
import { ideaGraphic } from "./ideas";
import { readMedia, storeMedia } from "./media";
import { getBrand, getWorkspace } from "./store";

// „Mit KI in Canva gestalten“: Claude formuliert aus Caption/Idee Headline und
// Subline, daraus wird die CI-Grafik gerechnet, als Asset nach Canva geladen
// und ein bearbeitbares Design angelegt. Der PNG-Export landet als Medium im
// Post (mit canva_design_id), damit er später aus Canva aktualisiert werden kann.
// Hinweis: Vorlagen (Brand Templates) automatisch befüllen kann die
// Connect API nur mit Canva Enterprise; hier ist die Grafik ein Bild im Design.

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export type DesignFormat = "feed" | "story";
const FORMATS: Record<DesignFormat, IdeaVisual["format"]> = { feed: "4:5", story: "9:16" };

export const CANVA_MISSING = "Canva ist noch nicht verbunden. Bitte zuerst im Marketing Hub unter Kanäle verbinden.";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "subline", "title"],
  properties: {
    headline: { type: "string", description: "Kernaussage für die Grafik, höchstens 60 Zeichen" },
    subline: { type: "string", description: "Zweite Zeile, höchstens 90 Zeichen, leer wenn unnötig" },
    title: { type: "string", description: "Kurzer Name für das Design in Canva" },
  },
} as const;

const SYSTEM = `Du bist Art Director bei GRID AGENCY. Für einen Social-Media-Post formulierst du den Text auf der Grafik.

Regeln:
- headline: die Kernaussage des Posts, knapp und stark, höchstens 60 Zeichen, ohne Hashtags und ohne Emojis.
- subline: ergänzt die Headline (Nutzen, Anlass, Ort oder Call-to-Action), höchstens 90 Zeichen; leer, wenn die Headline allein trägt.
- Halte dich an Tonalität und Dos & Don'ts der CI. Keine erfundenen Zahlen oder Preise.
- Sprache wie der Post (meist Deutsch).`;

const clip = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Headline und Subline ohne Claude aus dem Text ableiten (Vorschau) */
function fallbackVisual(text: string) {
  const plain = text.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/[\p{Extended_Pictographic}️]/gu, "").replace(/\s+/g, " ").trim();
  const [first = "Neuer Post", second = ""] = plain.split(/(?<=[.!?])\s+/);
  const short = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).replace(/\s+\S*$/, "")} …` : s);
  return { headline: short(first.replace(/[.!]$/, ""), 60), subline: short(second, 90), title: short(first, 50) };
}

async function visualFor(workspaceId: string, caption: string, brief: string) {
  if (DEMO) return fallbackVisual(brief || caption);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Claude ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)");
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const brand = await getBrand(workspaceId);
  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [agentBrief(workspace.name, brand), brief ? `## Idee für die Grafik\n${brief}` : "", `## Caption des Posts\n${caption || "(noch leer)"}`].filter(Boolean).join("\n\n"),
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude hat keinen Text für die Grafik geliefert");
  const raw = JSON.parse(block.text) as { headline?: string; subline?: string; title?: string };
  const fallback = fallbackVisual(brief || caption);
  return { headline: clip(raw.headline, 70) || fallback.headline, subline: clip(raw.subline, 100), title: clip(raw.title, 80) || fallback.title };
}

// Demo: gerechnete Grafik je Design merken, damit „Aus Canva aktualisieren“ etwas liefert
const demoDesigns = new Map<string, { path: string; width: number; height: number }>();

export type AiDesignResult = { item: MediaItem; edit_url: string | null; headline: string; subline: string };

export async function aiCanvaDesign(workspaceId: string, input: { caption: string; brief?: string; format: DesignFormat }): Promise<AiDesignResult> {
  if (!DEMO && !(await canvaAccount())) throw new Error(CANVA_MISSING);
  const caption = input.caption.trim().slice(0, 3000);
  const brief = (input.brief ?? "").trim().slice(0, 500);
  if (!caption && !brief) throw new Error("Erst Text oder eine Idee eingeben");

  const text = await visualFor(workspaceId, caption, brief);
  const format = FORMATS[input.format] ?? "4:5";
  const visual: IdeaVisual = { headline: text.headline, subline: text.subline || undefined, format };
  const image = await ideaGraphic(workspaceId, visual);
  const size = { width: image.width, height: image.height };
  const title = `KI · ${text.title || text.headline}`.slice(0, 120);

  if (DEMO) {
    const id = `demo-ai-${randomUUID().slice(0, 8)}`;
    const item = await storeMedia(image.bytes, "image/png", `canva-${id}`, { ...size, canva_design_id: id });
    demoDesigns.set(id, { path: item.path, ...size });
    return { item, edit_url: demoEditUrl(id), headline: text.headline, subline: text.subline };
  }

  const asset = await uploadAsset(image.bytes, title);
  const design = await createDesign({ title, ...size, asset_id: asset.id, workspace_id: workspaceId });
  let item: MediaItem;
  try {
    const [exported] = await exportDesign(design.id, "png", { pages: [1] });
    if (!exported) throw new Error("leerer Export");
    item = { ...exported, ...size };
  } catch (error) {
    // Design steht in Canva; dann eben die eigene Grafik (gleicher Inhalt) ablegen
    console.error("Canva-Export nach KI-Design", error);
    item = await storeMedia(image.bytes, "image/png", `canva-${design.id}`, { ...size, canva_design_id: design.id });
  }
  return { item, edit_url: design.edit_url, headline: text.headline, subline: text.subline };
}

/** Design erneut exportieren (nach Änderungen in Canva); erste Seite als PNG */
export async function refreshCanvaDesign(designId: string): Promise<MediaItem> {
  if (DEMO) {
    const known = demoDesigns.get(designId);
    const file = known ? await readMedia(known.path) : null;
    if (!known || !file) throw new Error("Design nicht gefunden (Vorschau)");
    return storeMedia(file.bytes, file.mime, `canva-${designId}`, { width: known.width, height: known.height, canva_design_id: designId });
  }
  if (!(await canvaAccount())) throw new Error(CANVA_MISSING);
  const [item] = await exportDesign(designId, "png", { pages: [1] });
  if (!item) throw new Error("Canva hat nichts exportiert");
  return item;
}
