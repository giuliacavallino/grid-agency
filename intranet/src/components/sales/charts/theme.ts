import type { Source } from "@/lib/sales/types";

// Diagrammfarben nach der Dataviz-Methode. Beide Modi sind eigens gewählte
// Stufen derselben Farbtöne und mit validate_palette.js geprüft:
//   dunkel gegen surface #34312d, hell gegen surface #ffffff –
//   Lightness-Band, Chroma, CVD ΔE ≥ 8 und Normalsicht ΔE ≥ 15 bestanden.
// Einzelne Töne liegen unter 3:1 Kontrast (dunkel: Grün; hell: Aqua, Gelb,
// Magenta), daher hat jedes Diagramm Legende + Tabellenansicht.
// Jede Quelle hat einen festen Slot (nie nach Rang), passend zu den
// Quellen-Badges in source.tsx: LinkedIn Blau, Instagram Pink, Meta Violett.
const SLOTS = {
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"],
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"],
};

const SOURCE_ORDER: Source[] = ["linkedin", "website", "empfehlung", "email", "instagram", "manuell", "meta"];

/** CSS-Variablen der Reihenfarben, je nach Systemmodus. Einmal in ChartCard gesetzt. */
export const CHART_VARS_CSS = `
.viz-root { ${SLOTS.dark.map((c, i) => `--series-${i + 1}: ${c};`).join(" ")} }
@media (prefers-color-scheme: light) {
  .viz-root { ${SLOTS.light.map((c, i) => `--series-${i + 1}: ${c};`).join(" ")} }
}`;

export const SOURCE_CHART_COLOR = Object.fromEntries(
  SOURCE_ORDER.map((source, i) => [source, `var(--series-${i + 1})`])
) as Record<Source, string>;

/** Eine Reihe → Slot 1 (Blau). */
export const SERIES_1 = "var(--series-1)";

/** 1.234 → „1,2 Tsd.“ für Achsenbeschriftungen */
export function compact(value: number) {
  return new Intl.NumberFormat("de-DE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Saubere Achsenschritte (1, 2, 2,5, 5 × 10ⁿ) bis mindestens max. */
export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1000) / 1000);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
