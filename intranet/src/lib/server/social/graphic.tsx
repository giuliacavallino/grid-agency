import "server-only";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { inkOn as textOn, type IdeaVisual } from "@/lib/marketing";

// Post-Grafik in der CI der Kundenwelt: Hauptfarbe als Fläche, Zweitfarbe als
// Akzent, Headline in der Hausschrift (Google Fonts, sonst Inter) und das Logo.
// Gerechnet mit next/og (Satori + Resvg), läuft ohne externe Dienste.

export const SIZES: Record<IdeaVisual["format"], { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "1.91:1": { width: 1200, height: 628 },
};

const fonts = new Map<string, ArrayBuffer | null>();

/** Schrift von Google Fonts als TTF (ohne woff2-Browserkennung liefert Google TTF) */
async function googleFont(family: string, weight: number) {
  const key = `${family}:${weight}`;
  if (fonts.has(key)) return fonts.get(key) ?? null;
  let data: ArrayBuffer | null = null;
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, { signal: AbortSignal.timeout(4000) });
    const url = css.ok ? (await css.text()).match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1] : null;
    if (url) {
      const file = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (file.ok) data = await file.arrayBuffer();
    }
  } catch {
    data = null;
  }
  fonts.set(key, data);
  return data;
}

export type GraphicInput = {
  name: string;
  color: string;
  secondary: string | null;
  /** Textfarbe; sonst automatisch Hell/Dunkel zum Hintergrund */
  ink?: string | null;
  logo: Uint8Array | null;
  font: string | null;
  visual: IdeaVisual;
};

export async function renderGraphic({ name, color, secondary, ink: textColor, logo, font, visual }: GraphicInput) {
  const { width, height } = SIZES[visual.format] ?? SIZES["4:5"];
  const background = /^#[0-9a-f]{6}$/i.test(color) ? color : "#141414";
  const ink = textColor && /^#[0-9a-f]{6}$/i.test(textColor) && textColor.toLowerCase() !== background.toLowerCase() ? textColor : textOn(background);
  const accent = secondary && /^#[0-9a-f]{6}$/i.test(secondary) && secondary.toLowerCase() !== background.toLowerCase() ? secondary : ink;
  const wide = width / height > 1.5;
  const unit = wide ? height / 628 : width / 1080;

  // Logo als PNG (Satori kann kein WebP), auf feste Höhe gebracht
  let logoImage: { src: string; width: number; height: number } | null = null;
  if (logo) {
    try {
      const target = Math.round(64 * unit);
      const png = await sharp(logo).resize({ height: target * 2, fit: "inside" }).png().toBuffer({ resolveWithObject: true });
      logoImage = { src: `data:image/png;base64,${png.data.toString("base64")}`, width: Math.round((png.info.width / png.info.height) * target), height: target };
    } catch {
      logoImage = null;
    }
  }

  const family = font?.trim() || "Inter";
  const [bold, regular] = await Promise.all([googleFont(family, 700), googleFont(family, 400)]);
  const fallback = !bold && family !== "Inter" ? await googleFont("Inter", 700) : null;
  const fontList = [
    ...(bold ?? fallback ? [{ name: "Brand", data: (bold ?? fallback)!, weight: 700 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Brand", data: regular, weight: 400 as const, style: "normal" as const }] : []),
  ];

  const headline = visual.headline.trim().slice(0, 120);
  const size = (wide ? 62 : 112) * unit * (headline.length > 70 ? 0.72 : headline.length > 40 ? 0.86 : 1);

  const element = (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background,
        color: ink,
        padding: `${Math.round(72 * unit)}px`,
        fontFamily: fontList.length ? "Brand" : undefined,
      }}
    >
      <div style={{ display: "flex", fontSize: 26 * unit, letterSpacing: 4 * unit, textTransform: "uppercase", opacity: 0.75 }}>{name}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", width: 140 * unit, height: 12 * unit, borderRadius: 6 * unit, background: accent, marginBottom: 36 * unit }} />
        <div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1 * unit }}>{headline}</div>
        {visual.subline ? <div style={{ display: "flex", marginTop: 28 * unit, fontSize: 40 * unit, lineHeight: 1.3, opacity: 0.8 }}>{visual.subline.slice(0, 160)}</div> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {logoImage ? (
          <div style={{ display: "flex", background: "#ffffff", borderRadius: 16 * unit, padding: `${Math.round(14 * unit)}px ${Math.round(18 * unit)}px` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori rendert nur <img> */}
            <img src={logoImage.src} width={logoImage.width} height={logoImage.height} alt="" />
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 30 * unit, fontWeight: 700 }}>{name}</div>
        )}
        <div style={{ display: "flex", width: 56 * unit, height: 56 * unit, borderRadius: 28 * unit, background: accent }} />
      </div>
    </div>
  );

  const response = new ImageResponse(element, { width, height, ...(fontList.length ? { fonts: fontList } : {}) });
  return { bytes: new Uint8Array(await response.arrayBuffer()), width, height };
}
