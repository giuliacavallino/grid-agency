import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import type { Brand } from "@/lib/marketing";
import { db } from "../db";
import { getBrand, getWorkspace } from "./store";

// Entwurf der CI-Welt mit Claude: aus Briefing (Aufgaben), Website und dem,
// was schon eingetragen ist. Das Team prüft und ergänzt; danach gilt die
// CI-Welt als feste Vorgabe für den Agenten.

const SYSTEM = `Du bist Brand-Strategin einer Social-Media-Agentur (GRID AGENCY) und leitest aus den gelieferten Unterlagen die CI-Vorgabe eines Kunden für Social Media ab.

Regeln:
- Deutsch, konkret und knapp. Jede Regel ist eine klare Anweisung, die ein Content-Agent direkt befolgen kann.
- Nur ableiten, was die Unterlagen hergeben. Fehlt etwas, lieber allgemein und vorsichtig formulieren als erfinden. Keine Farben oder Schriften erfinden: nur übernehmen, wenn sie in den Unterlagen stehen.
- Dos und Don'ts: je 5–10 Punkte zu Tonalität, Inhalten, Bildsprache, Gestaltung und No-Gos.
- Hashtags: 5–15 passende, ohne generische Spam-Tags.
- Bereits eingetragene Inhalte respektieren und nur ergänzen.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tone", "audience", "imagery", "dos", "donts", "hashtags", "colors", "fonts"],
  properties: {
    tone: { type: "string", description: "Tonalität und Ansprache (du/ihr/Sie), 2–4 Sätze" },
    audience: { type: "string", description: "Zielgruppe, 1–3 Sätze" },
    imagery: { type: "string", description: "Bildsprache und Gestaltung, 2–4 Sätze" },
    dos: { type: "array", items: { type: "string" } },
    donts: { type: "array", items: { type: "string" } },
    hashtags: { type: "array", items: { type: "string" } },
    colors: {
      type: "array",
      description: "Nur Farben, die in den Unterlagen genannt sind (Hex)",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hex", "role"],
        properties: { name: { type: "string" }, hex: { type: "string" }, role: { type: "string", enum: ["Primär", "Sekundär", "Akzent", "Hintergrund", "Text", "Sonstige"] } },
      },
    },
    fonts: {
      type: "array",
      description: "Nur Schriften, die in den Unterlagen genannt sind",
      items: { type: "object", additionalProperties: false, required: ["role", "family"], properties: { role: { type: "string" }, family: { type: "string" } } },
    },
  },
} as const;

type Suggestion = Pick<Brand, "tone" | "audience" | "imagery" | "dos" | "donts" | "hashtags" | "colors" | "fonts">;

let client: Anthropic | null = null;

/** Website als Text (ohne Skripte und Styles), gekürzt */
async function websiteText(url: string) {
  try {
    const response = await fetch(url.startsWith("http") ? url : `https://${url}`, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!response.ok) return "";
    const html = await response.text();
    const colors = [...new Set(html.match(/#[0-9a-f]{6}\b/gi) ?? [])].slice(0, 20).join(", ");
    const fonts = [...new Set([...html.matchAll(/font-family:\s*([^;"}]+)/gi)].map((m) => m[1].trim()))].slice(0, 10).join(" | ");
    const body = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 8000);
    return `Text: ${body}\nFarbwerte im Quelltext: ${colors || "-"}\nSchriften im Quelltext: ${fonts || "-"}`;
  } catch {
    return "";
  }
}

export async function suggestBrand(workspaceId: string): Promise<Suggestion> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const brand = await getBrand(workspaceId);
  if (DEMO && !process.env.ANTHROPIC_API_KEY) {
    return {
      tone: "Herzlich, bodenständig, mit einem Augenzwinkern. Wir sprechen unsere Community mit „ihr“ an.",
      audience: "Familien und Berufstätige aus der Nachbarschaft, die Wert auf frische, handwerkliche Backwaren legen.",
      imagery: "Warme, natürliche Lichtstimmung, echte Produkte in der Backstube, Hände bei der Arbeit, keine Stockfotos.",
      dos: ["Handwerk und Frische zeigen", "Mitarbeitende mit Namen vorstellen", "Saisonale Produkte hervorheben"],
      donts: ["Keine Preisaktionen ohne Freigabe", "Keine Stockfotos", "Keine Ironie über Kund*innen"],
      hashtags: ["#bäckereisonne", "#handwerk", "#frischgebacken"],
      colors: [],
      fonts: [],
    };
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");

  const project = workspace.project_id ? await db().get("task_projects", workspace.project_id) : null;
  const site = brand.website ? await websiteText(brand.website) : "";
  const input = [
    `Kunde: ${workspace.name}`,
    "",
    "Bisher eingetragen:",
    JSON.stringify({ tone: brand.tone, audience: brand.audience, imagery: brand.imagery, dos: brand.dos, donts: brand.donts, colors: brand.colors, fonts: brand.fonts }),
    "",
    "Briefing aus dem Projekt:",
    String(project?.briefing ?? "(kein Briefing)").slice(0, 12_000),
    "",
    `Website (${brand.website ?? "keine"}):`,
    site || "(nicht verfügbar)",
  ].join("\n");

  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: input }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude hat keinen Vorschlag geliefert");
  return JSON.parse(block.text) as Suggestion;
}
