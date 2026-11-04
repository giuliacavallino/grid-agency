import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { DEMO } from "@/lib/config";
import type { BrandColor, BrandFont } from "@/lib/marketing";
import { exportDesign, listDesigns, listFolderItems, workspaceFolder } from "./canva";
import { readMedia } from "./media";
import { getBrand, getWorkspace, listPosts, updateBrand, updateWorkspaceSettings, workspaceSettings } from "./store";

// Stil eines Kunden aus seinen vorhandenen Canva-Posts lernen: Die Canva-
// Schnittstelle gibt Brand Kits nicht heraus. Deshalb exportiert der Hub die
// letzten Social-Designs aus dem Kundenordner (bzw. mit Kundennamen im Titel),
// Claude liest daraus Farben (Hex), Schriften, Layout und Textstil. Das Ergebnis
// liegt in settings.canva_style und steuert die KI-Designs. Leere Farben und
// Schriften im Markenkit werden damit befüllt, gepflegte bleiben unangetastet.

export type CanvaStyle = {
  at: string;
  folder: string | null;
  designs: { id: string; title: string; path: string }[];
  palette: { hex: string; role: BrandColor["role"] }[];
  fonts: { role: string; family: string }[];
  layout: string;
  typography: string;
  text_style: string;
  logo_usage: string;
  error?: string;
};

const MAX_AGE = 21 * 24 * 3600_000;
const SOCIAL = /(ig|insta|beitr|post|story|storys|stories|reel|feed|karussell|carousel|social|content|4:5|9:16|1:1)/i;
const NOT_SOCIAL = /(reporting|report|pitch|deck|moodboard|skript|script|strategie|plakat|visitenkarte|bewerbung|banderole|aufsteller|flyer|speisekarte|\.pdf|\ba[0-6]\b|display|präsentation|presentation|angebot)/i;
const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

let client: Anthropic | null = null;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["palette", "fonts", "layout", "typography", "text_style", "logo_usage"],
  properties: {
    palette: {
      type: "array",
      description: "Markenfarben, die in den Designs wiederkehren, als Hex (#rrggbb), wichtigste zuerst, höchstens 6",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["hex", "role"],
        properties: { hex: { type: "string" }, role: { type: "string", enum: ["Primär", "Sekundär", "Akzent", "Hintergrund", "Text", "Sonstige"] } },
      },
    },
    fonts: {
      type: "array",
      description: "Schriften, nur wenn eindeutig erkennbar (Google-Fonts-Name), sonst leer",
      items: { type: "object", additionalProperties: false, required: ["role", "family"], properties: { role: { type: "string" }, family: { type: "string" } } },
    },
    layout: { type: "string", description: "Aufbau der Grafiken: Flächen, Fotos, Rahmen, Formen, Weißraum (1–3 Sätze)" },
    typography: { type: "string", description: "Schriftbild: Versalien, Gewicht, Größe, Ausrichtung (1–2 Sätze)" },
    text_style: { type: "string", description: "Texte auf den Grafiken: Länge, Ansprache, typische Formulierungen, Emojis ja/nein (1–2 Sätze)" },
    logo_usage: { type: "string", description: "Wo und wie das Logo steht (1 Satz)" },
  },
} as const;

/** Social-Designs des Kunden in Canva: zuerst aus dem Kundenordner, dann per Suche */
async function referenceDesigns(workspaceId: string, name: string) {
  const picked = new Map<string, { id: string; title: string; pages: number | null }>();
  const add = (d: { id: string; title: string; page_count: number | null }) => {
    if (picked.size < 4 && !picked.has(d.id) && SOCIAL.test(d.title) && !NOT_SOCIAL.test(d.title)) picked.set(d.id, { id: d.id, title: d.title, pages: d.page_count });
  };
  let folder: string | null = null;
  try {
    const folderId = await workspaceFolder(workspaceId);
    folder = ((await workspaceSettings(workspaceId)).canva_folder_path as string | undefined) ?? null;
    const items = await listFolderItems(folderId, 2);
    items.forEach((i) => i.type === "design" && add(i));
    // Unterordner wie „Social Media“ oder „Posts“
    for (const sub of items.filter((i) => i.type === "folder").slice(0, 4)) {
      if (picked.size >= 4) break;
      (await listFolderItems(sub.id, 1).catch(() => [])).forEach((i) => i.type === "design" && add(i));
    }
  } catch (error) {
    console.error("Canva-Kundenordner", error);
  }
  if (picked.size < 4) {
    const key = normalize(name);
    const first = normalize(name.split(/\s+/)[0] ?? "");
    const mine = (title: string) => normalize(title).includes(key) || (first.length >= 4 && normalize(title).includes(first));
    for (const d of (await listDesigns(name)).items) if (mine(d.title)) add(d);
  }
  return { folder, designs: [...picked.values()] };
}

const png = async (path: string, max: number) => {
  const file = await readMedia(path);
  return file ? sharp(file.bytes).resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).png().toBuffer() : null;
};

/** Stil aus Canva neu lernen und speichern */
export async function learnCanvaStyle(workspaceId: string): Promise<CanvaStyle> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const empty: CanvaStyle = { at: new Date().toISOString(), folder: null, designs: [], palette: [], fonts: [], layout: "", typography: "", text_style: "", logo_usage: "" };
  if (DEMO) return empty;
  let style = empty;
  try {
    const { folder, designs } = await referenceDesigns(workspaceId, workspace.name);
    style = { ...empty, folder };
    const exported = (
      await Promise.all(
        designs.map(async (d) => {
          const [page] = await exportDesign(d.id, "png", { pages: [1] }).catch(() => []);
          return page ? { id: d.id, title: d.title, path: page.path } : null;
        })
      )
    ).filter((d): d is NonNullable<typeof d> => !!d);
    style.designs = exported;
    if (!exported.length) throw new Error(`Keine Social-Designs zu „${workspace.name}“ in Canva gefunden`);
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");

    const images = (await Promise.all(exported.map((d) => png(d.path, 1200)))).filter((b): b is Buffer => !!b);
    client ??= new Anthropic();
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 6000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system:
        "Du bist Art Director. Du analysierst bestehende Social-Media-Designs eines Kunden und hältst seine visuelle CI fest, damit neue Designs genauso aussehen. Nur beschreiben, was wiederkehrt und zu sehen ist; Hex-Werte genau aus den Farbflächen ablesen; Schriftnamen nur nennen, wenn du dir sicher bist. Deutsch.",
      messages: [
        {
          role: "user",
          content: [
            ...images.map((b) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: b.toString("base64") } })),
            { type: "text" as const, text: `Bestehende Canva-Designs von ${workspace.name}: ${exported.map((d) => `„${d.title}“`).join(", ")}.` },
          ],
        },
      ],
    });
    const block = response.content.find((b) => b.type === "text");
    if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude konnte die Designs nicht auslesen");
    const raw = JSON.parse(block.text) as Omit<CanvaStyle, "at" | "folder" | "designs">;
    const hex = (v: string) => (/^#?[0-9a-f]{6}$/i.test(v.trim()) ? `#${v.trim().replace("#", "").toLowerCase()}` : null);
    style.palette = raw.palette.map((c) => ({ hex: hex(c.hex), role: c.role })).filter((c): c is CanvaStyle["palette"][number] => !!c.hex).slice(0, 6);
    style.fonts = raw.fonts.filter((f) => f.family.trim()).slice(0, 3);
    style.layout = raw.layout;
    style.typography = raw.typography;
    style.text_style = raw.text_style;
    style.logo_usage = raw.logo_usage;

    // Leeres Markenkit ergänzen; was das Team gepflegt hat, bleibt
    const brand = await getBrand(workspaceId);
    const patch: { colors?: BrandColor[]; fonts?: BrandFont[] } = {};
    if (!brand.colors.length && style.palette.length) patch.colors = style.palette.map((c, i) => ({ name: `Canva ${i + 1}`, hex: c.hex, role: c.role }));
    if (!brand.fonts.length && style.fonts.length) patch.fonts = style.fonts.map((f) => ({ role: f.role, family: f.family, notes: "aus Canva-Designs erkannt, bitte prüfen" }));
    if (patch.colors || patch.fonts) await updateBrand(workspaceId, patch);
  } catch (error) {
    console.error("Canva-Stil lernen", error);
    style.error = error instanceof Error ? error.message : "Fehler";
  }
  await updateWorkspaceSettings(workspaceId, { canva_style: style });
  return style;
}

/** Gelernter Stil (frisch genug), sonst neu lernen */
export async function canvaStyle(workspaceId: string): Promise<CanvaStyle | null> {
  if (DEMO) return null;
  const saved = (await workspaceSettings(workspaceId)).canva_style as CanvaStyle | undefined;
  if (saved && Date.now() - new Date(saved.at).getTime() < MAX_AGE && (saved.designs.length || Date.now() - new Date(saved.at).getTime() < 24 * 3600_000)) return saved;
  return learnCanvaStyle(workspaceId).catch(() => saved ?? null);
}

/** Stil als Text für Claude */
export function styleBrief(style: CanvaStyle | null) {
  if (!style || (!style.layout && !style.palette.length)) return "";
  return [
    "## Visueller Stil aus den bestehenden Canva-Designs (so sollen neue Designs aussehen)",
    style.palette.length && `Farben: ${style.palette.map((c) => `${c.role} ${c.hex}`).join(", ")}`,
    style.fonts.length && `Schriften: ${style.fonts.map((f) => `${f.role}: ${f.family}`).join(", ")}`,
    style.layout && `Aufbau: ${style.layout}`,
    style.typography && `Schriftbild: ${style.typography}`,
    style.text_style && `Texte auf Grafiken: ${style.text_style}`,
    style.logo_usage && `Logo: ${style.logo_usage}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Referenzbilder (bestehende Designs) für Claude, verkleinert */
export async function styleImages(style: CanvaStyle | null, count = 3) {
  const list = await Promise.all((style?.designs ?? []).slice(0, count).map((d) => png(d.path, 900).catch(() => null)));
  return list.filter((b): b is Buffer => !!b).map((b) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: b.toString("base64") } }));
}

/** Bisherige Beiträge als Stilvorlage (veröffentlicht oder eingeplant, neueste zuerst) */
export async function recentCaptions(workspaceId: string, count = 6) {
  const posts = await listPosts({ workspace_id: workspaceId, limit: 60 }).catch(() => []);
  const captions = posts
    .filter((p) => ["published", "scheduled"].includes(p.status) && p.caption.trim().length > 20)
    .slice(0, count)
    .map((p) => p.caption.trim().slice(0, 700));
  if (!captions.length) return "";
  return `## Bisherige Beiträge (Ton, Länge, Emojis und Hashtags daran orientieren, nicht kopieren)\n${captions.map((c, i) => `### Beitrag ${i + 1}\n${c}`).join("\n\n")}`;
}
