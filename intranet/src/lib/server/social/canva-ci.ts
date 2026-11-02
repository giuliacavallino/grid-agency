import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { DEMO } from "@/lib/config";
import type { Brand } from "@/lib/marketing";
import { exportDesign, listDesigns, type CanvaDesign } from "./canva";
import { readMedia, storeMedia } from "./media";
import { getBrand, getWorkspace, updateBrand, updateWorkspace } from "./store";

// CI aus Canva übernehmen. Die Canva-Schnittstelle gibt Brand Kits nicht
// heraus; deshalb liegt je Kunde ein Design „CI – <Kunde>“:
//   Seite 1: nur das Logo (am besten mit transparentem Hintergrund)
//   Seite 2: Farben, Schriften, gern Tonalität und Dos & Don'ts
// Seite 1 wird das Logo der Akte, Seite 2 liest Claude aus.

const normalize = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Design „CI – <Kunde>“ finden (Bindestrich, Doppelpunkt, Groß/Klein egal) */
async function findCiDesign(name: string): Promise<CanvaDesign | null> {
  const target = normalize(`CI ${name}`);
  for (const query of [`CI ${name}`, name]) {
    const { items } = await listDesigns(query);
    const exact = items.find((d) => normalize(d.title) === target);
    if (exact) return exact;
    const loose = items.find((d) => normalize(d.title).startsWith("ci") && normalize(d.title).includes(normalize(name)));
    if (loose) return loose;
  }
  return null;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["colors", "fonts", "tone", "audience", "imagery", "dos", "donts", "hashtags"],
  properties: {
    colors: {
      type: "array",
      description: "Markenfarben als Hex, nur die tatsächlich gezeigten",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hex", "role"],
        properties: { name: { type: "string" }, hex: { type: "string" }, role: { type: "string", enum: ["Primär", "Sekundär", "Akzent", "Hintergrund", "Text", "Sonstige"] } },
      },
    },
    fonts: {
      type: "array",
      description: "Schriften mit Rolle (z. B. Überschrift, Text), nur wenn genannt",
      items: { type: "object", additionalProperties: false, required: ["role", "family"], properties: { role: { type: "string" }, family: { type: "string" } } },
    },
    tone: { type: "string", description: "Tonalität, leer wenn nicht genannt" },
    audience: { type: "string", description: "Zielgruppe, leer wenn nicht genannt" },
    imagery: { type: "string", description: "Bildsprache, leer wenn nicht genannt" },
    dos: { type: "array", items: { type: "string" } },
    donts: { type: "array", items: { type: "string" } },
    hashtags: { type: "array", items: { type: "string" } },
  },
} as const;

type Extracted = Pick<Brand, "colors" | "fonts" | "tone" | "audience" | "imagery" | "dos" | "donts" | "hashtags">;

let client: Anthropic | null = null;

/** Seite als verkleinertes PNG (spart Tokens) */
async function pagePng(path: string, max = 1600) {
  const file = await readMedia(path);
  if (!file) throw new Error("Export aus Canva nicht lesbar");
  return sharp(file.bytes).resize({ width: max, height: max, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

async function readCi(pages: Buffer[], name: string): Promise<Extracted> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system:
      "Du liest CI-Unterlagen (Styleguide-Seiten aus Canva) eines Kunden aus und überträgst sie exakt. Nur übernehmen, was auf den Seiten steht oder eindeutig zu sehen ist: Farben als Hex (gezeigte Hex-Werte bevorzugen, sonst aus den Farbflächen ablesen), Schriftnamen nur wenn genannt. Nichts erfinden; fehlt etwas, leer lassen. Deutsch.",
    messages: [
      {
        role: "user",
        content: [
          ...pages.map((png) => ({ type: "image" as const, source: { type: "base64" as const, media_type: "image/png" as const, data: png.toString("base64") } })),
          { type: "text" as const, text: `CI-Unterlagen von ${name}. Seite 1 ist das Logo, die weiteren Seiten der Styleguide.` },
        ],
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude konnte die CI nicht auslesen");
  return JSON.parse(block.text) as Extracted;
}

export type CanvaImport = { design: string; logo: boolean; updated: string[] };

/** Logo und CI aus dem Canva-Design „CI – <Kunde>“ in die Akte übernehmen */
export async function importCiFromCanva(workspaceId: string): Promise<CanvaImport> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  if (DEMO) return { design: `CI – ${workspace.name}`, logo: false, updated: [] };

  const design = await findCiDesign(workspace.name);
  if (!design) throw new Error(`In Canva gibt es kein Design „CI – ${workspace.name}“. Bitte anlegen: Seite 1 Logo, Seite 2 Farben und Schriften.`);

  // Seite 1 → Logo (transparent, Ränder abgeschnitten)
  let [logoPage] = await exportDesign(design.id, "png", { pages: [1], transparent: true }).catch(() => exportDesign(design.id, "png", { pages: [1] }));
  if (!logoPage) throw new Error("Canva hat keine Seite exportiert");
  const raw = await readMedia(logoPage.path);
  if (!raw) throw new Error("Logo aus Canva nicht lesbar");
  const trimmed = await sharp(raw.bytes).trim().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const logo = await storeMedia(new Uint8Array(trimmed), "image/png", "logo");
  const brand = await getBrand(workspaceId);
  await updateBrand(workspaceId, { logos: [...brand.logos.filter((l) => l.variant !== "Hauptlogo"), { path: logo.path, variant: "Hauptlogo", notes: "aus Canva" }] });
  await updateWorkspace(workspaceId, { logo_path: logo.path });
  logoPage = { ...logoPage, path: logo.path };

  // Weitere Seiten → Farben, Schriften, Vorgaben
  const updated: string[] = ["Logo"];
  if ((design.page_count ?? 1) > 1) {
    const pages = Array.from({ length: Math.min((design.page_count ?? 2) - 1, 4) }, (_, i) => i + 2);
    const exported = await exportDesign(design.id, "png", { pages });
    const images = await Promise.all([logoPage, ...exported].map((m) => pagePng(m.path)));
    const ci = await readCi(images, workspace.name);
    const current = await getBrand(workspaceId);
    const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
    const patch: Partial<Brand> = {};
    const take = <K extends keyof Extracted>(key: K, value: Brand[K], label: string, when: boolean) => {
      if (!when) return;
      patch[key] = value;
      updated.push(label);
    };
    take("colors", ci.colors, "Farben", ci.colors.length > 0);
    take("fonts", ci.fonts, "Schriften", ci.fonts.length > 0);
    take("tone", ci.tone, "Tonalität", !!ci.tone);
    take("audience", ci.audience, "Zielgruppe", !!ci.audience);
    take("imagery", ci.imagery, "Bildsprache", !!ci.imagery);
    take("dos", union(current.dos, ci.dos), "Dos", ci.dos.length > 0);
    take("donts", union(current.donts, ci.donts), "Don'ts", ci.donts.length > 0);
    take("hashtags", union(current.hashtags, ci.hashtags), "Hashtags", ci.hashtags.length > 0);
    if (Object.keys(patch).length) await updateBrand(workspaceId, patch);
  }
  return { design: design.title, logo: true, updated };
}
