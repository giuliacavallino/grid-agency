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
  if (!design) {
    // Kein CI-Design: Canva nach Logo und Unterlagen zum Kunden durchsuchen
    const scan = await scanCanva(workspaceId);
    if (scan.error) throw new Error(`Canva: ${scan.error}`);
    if (!scan.logo) throw new Error(`In Canva nichts Passendes gefunden (${scan.designs.length} Designs, ${scan.images.length} Bilder zu „${workspace.name}“). Tipp: Design „CI – ${workspace.name}“ anlegen.`);
    return { design: scan.logo, logo: true, updated: ["Logo"] };
  }

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

// ---------- Canva durchsuchen (je Kundenakte) ----------

export type CanvaScan = {
  at: string;
  designs: { id: string; title: string; pages: number | null }[];
  images: { id: string; name: string }[];
  folders: { id: string; name: string }[];
  logo: string | null;
  error?: string;
};

/** Sucht in Canva alles zum Kunden (Designs, Uploads, Ordner), merkt sich die
 * Funde in settings.canva_scan und setzt ein Logo, falls noch keins da ist:
 * zuerst ein Design mit „Logo“ im Titel (Export als PNG), sonst ein Bild. */
export async function scanCanva(workspaceId: string): Promise<CanvaScan> {
  const { listFolderItems } = await import("./canva");
  const { updateWorkspaceSettings } = await import("./store");
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const key = normalize(workspace.name);
  const matches = (text: string) => normalize(text).includes(key);
  const scan: CanvaScan = { at: new Date().toISOString(), designs: [], images: [], folders: [], logo: null };
  try {
    const designs = new Map<string, CanvaDesign>();
    for (const query of [workspace.name, `${workspace.name} Logo`]) {
      for (const d of (await listDesigns(query)).items) designs.set(d.id, d);
    }
    const root = await listFolderItems("root");
    const folders = root.filter((i): i is Extract<typeof i, { type: "folder" }> => i.type === "folder" && matches(i.name));
    const inFolders = (await Promise.all(folders.map((f) => listFolderItems(f.id, 2)))).flat();
    const uploads = await listFolderItems("uploads").catch(() => []);
    const images = [...inFolders, ...uploads].filter((i): i is Extract<typeof i, { type: "image" }> => i.type === "image" && (inFolders.includes(i) || matches(i.name)));
    for (const d of inFolders) if (d.type === "design") designs.set(d.id, { id: d.id, title: d.title, thumbnail: d.thumbnail, edit_url: null, view_url: null, updated_at: null, page_count: d.page_count });

    scan.designs = [...designs.values()].slice(0, 40).map((d) => ({ id: d.id, title: d.title, pages: d.page_count }));
    scan.images = images.slice(0, 40).map((i) => ({ id: i.id, name: i.name }));
    scan.folders = folders.map((f) => ({ id: f.id, name: f.name }));

    const brand = await getBrand(workspaceId);
    if (!brand.logos.some((l) => l.variant === "Hauptlogo")) {
      let bytes: Buffer | null = null;
      const design = [...designs.values()].find((d) => /logo/i.test(d.title));
      if (design) {
        const [page] = await exportDesign(design.id, "png", { pages: [1], transparent: true }).catch(() => exportDesign(design.id, "png", { pages: [1] }));
        const file = page ? await readMedia(page.path) : null;
        if (file) bytes = Buffer.from(file.bytes);
        if (bytes) scan.logo = `Design „${design.title}“`;
      }
      const image = !bytes ? images.find((i) => /logo/i.test(i.name)) : undefined;
      if (image?.thumbnail) {
        const response = await fetch(image.thumbnail);
        if (response.ok) {
          bytes = Buffer.from(await response.arrayBuffer());
          scan.logo = `Bild „${image.name}“`;
        }
      }
      if (bytes) {
        const trimmed = await sharp(bytes).trim().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        const logo = await storeMedia(new Uint8Array(trimmed), "image/png", "logo");
        await updateBrand(workspaceId, { logos: [...brand.logos, { path: logo.path, variant: "Hauptlogo", notes: `aus Canva: ${scan.logo}` }] });
        await updateWorkspace(workspaceId, { logo_path: logo.path });
      }
    }
  } catch (error) {
    scan.error = error instanceof Error ? error.message : "Fehler";
  }
  await updateWorkspaceSettings(workspaceId, { canva_scan: scan, canva_scan_requested: false });
  return scan;
}

/** Angeforderte Canva-Suchen ausführen (settings.canva_scan_requested = true) */
export async function runRequestedCanvaScans() {
  if (DEMO) return 0;
  const { listWorkspaces, workspaceSettings, updateWorkspaceSettings } = await import("./store");
  let count = 0;
  for (const workspace of await listWorkspaces()) {
    const settings = await workspaceSettings(workspace.id);
    if (settings.canva_scan_requested !== true) continue;
    await updateWorkspaceSettings(workspace.id, { canva_scan_requested: false });
    await scanCanva(workspace.id);
    count++;
  }
  return count;
}
