import "server-only";
import sharp from "sharp";
import { DEMO } from "@/lib/config";
import type { MediaItem } from "@/lib/marketing";
import { publicMediaUrl, readMedia, storeFromUrl, storeMedia } from "../social/media";
import { readJson } from "../social/oauth";
import { getBrand } from "../social/store";

// Bildbearbeitung für Rohbilder, für Team und Agent:
// - im Intranet (sharp, ohne Schlüssel): Zuschnitt auf Plattform-Formate mit
//   Motiv-Erkennung, Helligkeit/Kontrast/Sättigung, Schärfen, Logo der
//   Kundenwelt als Wasserzeichen, Ausgabe als JPG/PNG/WebP
// - Photoroom: Hintergrund entfernen oder per KI ersetzen (Produkt, Food)
// - Claid.ai: automatisch verbessern (Licht, Farbe, Rauschen, Hochskalieren)
// Kamera-RAW (CR3, NEF, ARW, DNG) bitte vorher als JPG oder TIFF exportieren.

export const imageToolsConfigured = () => ({
  photoroom: DEMO || !!process.env.PHOTOROOM_API_KEY,
  claid: DEMO || !!process.env.CLAID_API_KEY,
});

export const IMAGE_TOOL_ENV = { photoroom: "PHOTOROOM_API_KEY", claid: "CLAID_API_KEY" } as const;

/** Formate der Plattformen (Breite × Höhe) */
export const FORMATS = {
  "4:5": [1080, 1350],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
  "1.91:1": [1200, 628],
} as const;

export type ImageFormat = keyof typeof FORMATS | "original";
export type LogoPosition = "oben-links" | "oben-rechts" | "unten-links" | "unten-rechts";

export type EditOptions = {
  format?: ImageFormat;
  /** -1 … 1, 0 = unverändert */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpen?: boolean;
  /** Logo der Kundenwelt einsetzen (Variante aus der CI-Welt, Standard Hauptlogo) */
  logo?: { workspace_id: string; variant?: string; position?: LogoPosition; size?: number };
  output?: "jpg" | "png" | "webp";
};

const clamp = (value: number | undefined, min = -1, max = 1) => Math.min(Math.max(Number(value) || 0, min), max);

async function source(path: string) {
  const file = await readMedia(path);
  if (!file) throw new Error("Bild nicht gefunden");
  if (!file.mime.startsWith("image/")) throw new Error("Das ist kein Bild");
  return file;
}

/** Bild im Intranet bearbeiten; das Original bleibt erhalten, es entsteht ein neues Medium */
export async function editImage(path: string, options: EditOptions): Promise<MediaItem> {
  const file = await source(path);
  // rotate(): Ausrichtung aus den Kameradaten übernehmen
  let image = sharp(Buffer.from(file.bytes), { failOn: "none" }).rotate();

  if (options.format && options.format !== "original") {
    const [width, height] = FORMATS[options.format];
    // attention: Ausschnitt dort, wo das Motiv ist (Kontrast, Haut, Sättigung)
    image = image.resize(width, height, { fit: "cover", position: sharp.strategy.attention });
  } else {
    image = image.resize({ width: 2160, height: 2160, fit: "inside", withoutEnlargement: true });
  }

  const brightness = clamp(options.brightness);
  const saturation = clamp(options.saturation);
  const contrast = clamp(options.contrast);
  if (brightness || saturation) image = image.modulate({ brightness: 1 + brightness * 0.5, saturation: 1 + saturation });
  // Kontrast um die Mitte: a·x + (128 − 128·a)
  if (contrast) {
    const a = 1 + contrast * 0.6;
    image = image.linear(a, 128 - 128 * a);
  }
  if (options.sharpen) image = image.sharpen({ sigma: 1 });

  if (options.logo) {
    const overlay = await logoOverlay(image, options.logo);
    if (overlay) image = sharp(await image.toBuffer()).composite([overlay]);
  }

  const output = options.output ?? "jpg";
  const encoded =
    output === "png" ? image.png() : output === "webp" ? image.webp({ quality: 90 }) : image.jpeg({ quality: 90, mozjpeg: true });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  const mime = output === "png" ? "image/png" : output === "webp" ? "image/webp" : "image/jpeg";
  return storeMedia(new Uint8Array(data), mime, "bearbeitet", { width: info.width, height: info.height });
}

/** Logo aus der CI-Welt passend skaliert in eine Ecke setzen */
async function logoOverlay(image: sharp.Sharp, logo: NonNullable<EditOptions["logo"]>) {
  const brand = await getBrand(logo.workspace_id);
  const chosen = brand.logos.find((l) => l.variant === (logo.variant ?? "Hauptlogo")) ?? brand.logos[0];
  if (!chosen) throw new Error("In der CI-Welt ist noch kein Logo hinterlegt");
  const file = await readMedia(chosen.path);
  if (!file) throw new Error("Logo nicht gefunden");
  const { info } = await image.clone().toBuffer({ resolveWithObject: true });
  const size = Math.min(Math.max(logo.size ?? 0.18, 0.05), 0.5);
  const width = Math.round(info.width * size);
  const margin = Math.round(info.width * 0.04);
  const resized = await sharp(Buffer.from(file.bytes)).resize({ width }).png().toBuffer({ resolveWithObject: true });
  const position = logo.position ?? "unten-rechts";
  return {
    input: resized.data,
    left: position.endsWith("links") ? margin : info.width - resized.info.width - margin,
    top: position.startsWith("oben") ? margin : info.height - resized.info.height - margin,
  };
}

// ---------- Photoroom: Hintergrund ----------

/** Hintergrund entfernen (transparentes PNG) oder ersetzen: Farbe (#rrggbb) oder KI-Beschreibung */
export async function photoroom(path: string, options: { background_color?: string; background_prompt?: string; format?: ImageFormat }): Promise<MediaItem> {
  const file = await source(path);
  if (DEMO && !process.env.PHOTOROOM_API_KEY) return storeMedia(file.bytes, file.mime, "freigestellt");
  const key = process.env.PHOTOROOM_API_KEY;
  if (!key) throw new Error("PHOTOROOM_API_KEY fehlt in Vercel");
  const form = new FormData();
  form.append("imageFile", new Blob([Buffer.from(file.bytes)], { type: file.mime }), "bild");
  form.append("removeBackground", "true");
  if (options.background_prompt) form.append("background.prompt", options.background_prompt.slice(0, 500));
  else if (options.background_color && /^#[0-9a-f]{6}$/i.test(options.background_color)) form.append("background.color", options.background_color.slice(1));
  if (options.format && options.format !== "original") {
    const [width, height] = FORMATS[options.format];
    form.append("outputSize", `${width}x${height}`);
    form.append("padding", "0.08");
  }
  const response = await fetch("https://image-api.photoroom.com/v2/edit", { method: "POST", headers: { "x-api-key": key }, body: form });
  if (!response.ok) await readJson(response, "Photoroom");
  const mime = (response.headers.get("content-type") ?? "image/png").split(";")[0];
  return storeMedia(new Uint8Array(await response.arrayBuffer()), mime, "freigestellt");
}

// ---------- Claid.ai: verbessern ----------

/** Rohbild automatisch verbessern: Licht, Farbe, Rauschen, Schärfe; optional hochskalieren */
export async function enhance(path: string, options: { upscale?: boolean; format?: ImageFormat }): Promise<MediaItem> {
  const file = await source(path);
  if (DEMO && !process.env.CLAID_API_KEY) return storeMedia(file.bytes, file.mime, "verbessert");
  const key = process.env.CLAID_API_KEY;
  if (!key) throw new Error("CLAID_API_KEY fehlt in Vercel");
  const operations: Record<string, unknown> = {
    restorations: { decompress: "auto", ...(options.upscale ? { upscale: "photo" } : {}) },
    adjustments: { hdr: 60, sharpness: 25 },
  };
  if (options.format && options.format !== "original") {
    const [width, height] = FORMATS[options.format];
    operations.resizing = { width, height, fit: "crop" };
  }
  // Claid holt das Bild selbst; dafür die öffentliche Adresse des Intranets
  const input = publicMediaUrl(path);
  if (!input.startsWith("https://")) throw new Error("INTRANET_URL fehlt: Claid braucht eine öffentliche Bildadresse");
  const result = await readJson<{ data: { output: { tmp_url: string } } }>(
    await fetch("https://api.claid.ai/v1-beta1/image/edit", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input, operations, output: { format: { type: "jpeg", quality: 92 } } }),
    }),
    "Claid"
  );
  return storeFromUrl(result.data.output.tmp_url, "verbessert");
}
