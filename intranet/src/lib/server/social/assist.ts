import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief, PROVIDERS, type PostProvider } from "@/lib/marketing";
import { recentCaptions } from "./brand-style";
import { readMedia } from "./media";
import { getBrand, getWorkspace } from "./store";

// KI-Assistent im Post-Editor: Caption schreiben, verbessern, kürzen, für
// eine Plattform anpassen, Emojis ergänzen oder Hashtags vorschlagen – immer
// in der CI der Kundenwelt. Liefert 2–3 Varianten bzw. 8–15 Hashtags.

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export const ASSIST_ACTIONS = ["write", "improve", "shorten", "adapt", "hashtags", "emojis"] as const;
export type AssistAction = (typeof ASSIST_ACTIONS)[number];

export const ASSIST_PROVIDERS: PostProvider[] = ["instagram", "facebook", "tiktok", "linkedin"];

/** Stil und Grenzen je Plattform */
const STYLE: Record<PostProvider, string> = {
  instagram: "Instagram: höchstens 2.200 Zeichen, ideal 300–900. Nur die ersten ~125 Zeichen sind ohne „mehr“ sichtbar, also starker erster Satz. Absätze, Emojis sparsam, Call-to-Action. Instagram erlaubt höchstens 5 Hashtags.",
  facebook: "Facebook: kurz und nahbar, ideal 80–400 Zeichen, eine Frage an die Community, 0–3 Hashtags.",
  tiktok: "TikTok: höchstens 2.200 Zeichen, ideal 100–300. Locker, Hook in den ersten Worten, 3–6 Hashtags.",
  linkedin: "LinkedIn: höchstens 3.000 Zeichen, ideal 700–1.400. Die ersten zwei Zeilen (~210 Zeichen) sind der Hook, kurze Absätze, sachlich-persönlich, Frage oder Call-to-Action am Ende, 3–5 Hashtags, kaum Emojis. Kein Link im Text.",
};

const TASK: Record<AssistAction, string> = {
  write: "Schreibe aus der Idee (und dem Bild, falls dabei) eine fertige Caption.",
  improve: "Verbessere die Caption: klarer, stärkerer Einstieg, in der Tonalität der CI. Inhalt und Fakten bleiben gleich.",
  shorten: "Kürze die Caption deutlich (etwa auf die Hälfte), ohne die Kernaussage und den Call-to-Action zu verlieren.",
  adapt: "Passe die Caption an die Zielplattform an (Länge, Aufbau, Ton, Hashtags nach den Regeln der Plattform).",
  emojis: "Ergänze die Caption dezent um wenige passende Emojis (höchstens 3–5, nicht in jeder Zeile). Text sonst unverändert lassen.",
  hashtags: "Schlage 8–15 passende Hashtags vor: Mischung aus reichweitenstarken, Nischen- und lokalen Hashtags. Hashtags der CI bevorzugen, sofern passend.",
};

const SYSTEM = `Du bist Senior Content Creator bei GRID AGENCY, einer Agentur für Social Media. Du hilfst dem Team, Captions für Kundenposts zu schreiben.

Regeln:
- Halte dich strikt an die CI-Vorgabe (Tonalität, Ansprache, Dos & Don'ts, Hashtags, Zielgruppe).
- Deutsch, wenn die CI oder der Text nichts anderes vorgibt.
- Keine Platzhalter, keine eckigen Klammern, keine erfundenen Zahlen, Preise, Zitate oder Personen.
- Behalte vorhandene Hashtags im Text bei, außer die Aufgabe verlangt etwas anderes.
- variants: 2–3 deutlich unterschiedliche, sofort verwendbare Fassungen des kompletten Texts (ohne Erklärungen, ohne Anführungszeichen drumherum).
- hashtags: nur bei der Aufgabe „Hashtags“, sonst leer. Jeweils mit #, ohne Leerzeichen.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["variants", "hashtags"],
  properties: {
    variants: { type: "array", items: { type: "string" } },
    hashtags: { type: "array", items: { type: "string" } },
  },
} as const;

export type AssistInput = {
  action: AssistAction;
  caption: string;
  brief?: string;
  /** gewählte Kanäle des Posts */
  platforms: PostProvider[];
  /** Zielplattform für „adapt“ */
  platform?: PostProvider;
  /** Erstes Bild des Posts (Storage-Pfad) als Kontext für „write“ */
  image?: string;
};

export type AssistResult = { variants: string[]; hashtags?: string[] };

const cleanTag = (tag: string) => {
  const t = tag.trim().replace(/\s+/g, "").replace(/^#+/, "");
  return t ? `#${t.slice(0, 60)}` : "";
};

export async function assistCaption(workspaceId: string, input: AssistInput): Promise<AssistResult> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const brand = await getBrand(workspaceId);
  if (DEMO) return demoAssist(workspace.name, brand.hashtags, input);
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Claude ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)");

  const platforms = input.action === "adapt" && input.platform ? [input.platform] : input.platforms;
  const history = await recentCaptions(workspaceId);
  const ask = [
    agentBrief(workspace.name, brand),
    history,
    "## Plattformen",
    platforms.length ? platforms.map((p) => STYLE[p]).join("\n") : "(keine gewählt – allgemein für Social Media)",
    input.action === "adapt" && input.platform ? `## Zielplattform\n${PROVIDERS[input.platform].label}` : "",
    input.brief?.trim() ? `## Idee / Stichworte\n${input.brief.trim()}` : "",
    `## Aktuelle Caption\n${input.caption.trim() || "(leer)"}`,
    `## Aufgabe\n${TASK[input.action]}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.action === "write" && input.image) {
    const file = await readMedia(input.image).catch(() => null);
    const mime = file?.mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif" | undefined;
    if (file && mime && ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime) && file.bytes.length < 4_500_000) {
      content.push({ type: "image", source: { type: "base64", media_type: mime, data: Buffer.from(file.bytes).toString("base64") } });
    }
  }
  content.push({ type: "text", text: ask });

  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude hat keinen Vorschlag geliefert");
  const raw = JSON.parse(block.text) as { variants?: unknown[]; hashtags?: unknown[] };
  const variants = (raw.variants ?? []).map((v) => (typeof v === "string" ? v.trim().slice(0, 5000) : "")).filter(Boolean).slice(0, 3);
  if (input.action === "hashtags") {
    const hashtags = [...new Set((raw.hashtags ?? []).map((h) => cleanTag(String(h))).filter(Boolean))].slice(0, 15);
    return { variants: [], hashtags };
  }
  if (!variants.length) throw new Error("Claude hat keinen Vorschlag geliefert");
  return { variants };
}

// ---------- Vorschau ohne Claude ----------

function demoAssist(name: string, brandTags: string[], input: AssistInput): AssistResult {
  const caption = input.caption.trim();
  const idea = input.brief?.trim() || caption.split("\n")[0] || "Neues aus unserer Backstube";
  const label = input.platform ? PROVIDERS[input.platform].label : "Social Media";
  switch (input.action) {
    case "write":
      return {
        variants: [
          `${idea} 🌾\n\nBei ${name} steckt in jedem Detail Handarbeit – und genau das schmeckt man.\n\nKommt vorbei und probiert selbst. Wir freuen uns auf euch!`,
          `Schon gehört? ${idea}.\n\nWir haben lange getüftelt, jetzt ist es so weit. Erzählt uns in den Kommentaren, was ihr als Erstes probiert.`,
          `${idea} – frisch, ehrlich, von hier.\n\nHeute ab 7 Uhr bei ${name}.`,
        ],
      };
    case "improve":
      return {
        variants: [
          `Frisch aus dem Ofen: ${caption.replace(/\s+/g, " ").slice(0, 160)}\n\nWir freuen uns auf euren Besuch!`,
          `${caption.split("\n")[0] || idea} – und zwar mit ganz viel Liebe gemacht.\n\nWas ist euer Favorit? Schreibt es uns!`,
        ],
      };
    case "shorten":
      return {
        variants: [
          (caption.split(/(?<=[.!?])\s/)[0] || idea).slice(0, 140),
          `${idea.slice(0, 80)} – heute bei ${name}.`,
        ],
      };
    case "adapt":
      return {
        variants:
          input.platform === "linkedin"
            ? [
                `${idea}.\n\nWas wir dabei gelernt haben: Qualität entsteht im Team – jeden Tag aufs Neue.\n\nWie haltet ihr in eurem Betrieb die Qualität hoch?\n\n#Handwerk #Team #Qualität`,
                `Ein kleiner Einblick hinter die Kulissen von ${name}:\n\n${caption.slice(0, 300) || idea}\n\nWir sind gespannt auf eure Erfahrungen.`,
              ]
            : input.platform === "tiktok"
              ? [`POV: ${idea} 👀 #fyp #handwerk`, `Wartet aufs Ende 😍 ${idea.slice(0, 80)} #foodtok`]
              : [
                  `${idea} ✨\n\n${caption.slice(0, 400) || `Bei ${name} gibt es heute etwas Besonderes.`}\n\nWas meint ihr? 👇`,
                  `Neu für ${label}: ${idea}. Kommt vorbei!`,
                ],
      };
    case "emojis":
      return {
        variants: [
          `${caption.replace(/\n/, " ☀️\n") || idea} 🥐`,
          `✨ ${caption || idea}`,
        ],
      };
    case "hashtags": {
      const base = ["#bäckerei", "#handwerk", "#frischgebacken", "#regional", "#backstube", "#brotliebe", "#foodlover", "#instafood", "#heimatliebe", "#lecker", "#supportyourlocal", "#morgenroutine"];
      return { variants: [], hashtags: [...new Set([...brandTags.map(cleanTag), ...base])].filter(Boolean).slice(0, 12) };
    }
  }
}
