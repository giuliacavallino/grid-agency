import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { cleanPlan, EMPTY_PLAN, type PostingPlan } from "@/lib/posting-plan";
import { getWorkspace, updateWorkspaceSettings, workspaceSettings } from "./store";

// Postingplan je Kundenwelt: liegt in settings.posting_plan. Aus einem
// Agenturvertrag (PDF) liest Claude die geschuldeten Mengen als Vorschlag aus;
// gespeichert wird erst, wenn das Team ihn bestätigt.

export async function getPostingPlan(workspaceId: string): Promise<PostingPlan> {
  const saved = (await workspaceSettings(workspaceId)).posting_plan as Partial<PostingPlan> | undefined;
  return saved ? cleanPlan(saved) : EMPTY_PLAN;
}

export async function savePostingPlan(workspaceId: string, input: Partial<PostingPlan>): Promise<PostingPlan> {
  const plan = cleanPlan({ ...(await getPostingPlan(workspaceId)), ...input });
  await updateWorkspaceSettings(workspaceId, { posting_plan: plan });
  return plan;
}

const RULE = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "count", "max", "period", "every"],
  properties: {
    kind: { type: "string", enum: ["beitrag", "reel", "foto", "karussell", "story"], description: "beitrag = alle Feed-Posts; reel = Video-Posts; foto = Bild-/Fotoposts; karussell; story" },
    count: { type: "integer", description: "Mindestmenge je Zeitraum (bei days: 1)" },
    max: { type: ["integer", "null"], description: "Obergrenze bei Spannen wie 3–4, sonst null" },
    period: { type: "string", enum: ["week", "month", "days"], description: "week, month oder days (Rhythmus wie „alle 2 Tage“)" },
    every: { type: ["integer", "null"], description: "nur bei days: alle N Tage, sonst null" },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rules", "start", "platforms", "notes"],
  properties: {
    rules: { type: "array", items: RULE },
    start: { type: ["string", "null"], description: "Ab wann der volle Content-Umfang gilt (YYYY-MM-DD), sonst Vertragsbeginn, sonst null" },
    platforms: { type: "array", items: { type: "string", enum: ["instagram", "facebook", "tiktok", "linkedin"] } },
    notes: { type: "string", description: "Weitere Regeln zum Posten in Stichpunkten (z. B. Storybewerbung neuer Beiträge, Feedbackschleifen, Freigabefristen, Musik), höchstens 6 Zeilen" },
  },
} as const;

let client: Anthropic | null = null;

/** Vertrag (PDF) lesen und den Postingplan vorschlagen (nicht speichern) */
export async function planFromContract(workspaceId: string, pdf: Uint8Array, filename: string): Promise<PostingPlan> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const current = await getPostingPlan(workspaceId);
  const source = { name: filename.slice(0, 200), at: new Date().toISOString() };
  if (DEMO) {
    return cleanPlan({
      ...current,
      rules: [
        { kind: "beitrag", count: 3, max: 4, period: "week" },
        { kind: "story", count: 10, period: "week" },
        { kind: "reel", count: 8, period: "month" },
        { kind: "foto", count: 6, period: "month" },
        { kind: "story", count: 40, period: "month" },
      ],
      platforms: ["instagram", "facebook", "tiktok"],
      notes: "Neue Beiträge per Story bewerben",
      source,
    });
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Claude ist nicht eingerichtet (ANTHROPIC_API_KEY fehlt)");
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system:
      "Du liest Agenturverträge einer Social-Media-Agentur und überträgst die geschuldeten Posting-Mengen exakt in Regeln. Wöchentliche und monatliche Angaben getrennt übernehmen (z. B. „3–4 Posts / Woche (monatlich: 8 Reels + 6 Fotoposts)“ → beitrag 3–4 pro Woche, reel 8 pro Monat, foto 6 pro Monat). Rhythmen wie „alle 2 Tage“ als period days mit every. Gilt der volle Umfang erst später (Onboarding), start auf den Beginn des vollen Umfangs setzen. Nichts erfinden.",
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") } },
          { type: "text", text: `Agenturvertrag mit ${workspace.name}. Lies den Postingplan aus.` },
        ],
      },
    ],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") throw new Error("Claude konnte den Vertrag nicht auslesen");
  const raw = JSON.parse(block.text) as Partial<PostingPlan>;
  return cleanPlan({ ...current, rules: raw.rules, start: raw.start, platforms: raw.platforms, notes: raw.notes, source });
}
