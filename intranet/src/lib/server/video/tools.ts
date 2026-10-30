import "server-only";
import { DEMO } from "@/lib/config";
import type { MediaItem } from "@/lib/marketing";
import { readMedia, storeFromUrl, storeMedia } from "../social/media";
import { readJson } from "../social/oauth";

// Video-Werkzeuge für Team und Agent, je mit eigenem API-Schlüssel:
// - Creatomate: Videos aus Vorlagen oder RenderScript rendern (Motion
//   Design, Schnitt/Trim, Untertitel, Musik). Ersetzt ffmpeg, das auf Vercel
//   an Größen- und Zeitgrenzen scheitert.
// - OpenAI Whisper: Transkript und Untertitel (SRT/VTT) aus Video oder Audio.
// - ElevenLabs: Voiceover (Text → Sprache) und Musik.
// Ergebnisse landen als Medien im Intranet und lassen sich direkt posten.

export const toolsConfigured = () => ({
  creatomate: DEMO || !!process.env.CREATOMATE_API_KEY,
  whisper: DEMO || !!process.env.OPENAI_API_KEY,
  elevenlabs: DEMO || !!process.env.ELEVENLABS_API_KEY,
});

export const TOOL_ENV = {
  creatomate: "CREATOMATE_API_KEY",
  whisper: "OPENAI_API_KEY",
  elevenlabs: "ELEVENLABS_API_KEY",
} as const;

function key(name: keyof typeof TOOL_ENV) {
  const value = process.env[TOOL_ENV[name]];
  if (!value) throw new Error(`${TOOL_ENV[name]} fehlt in Vercel`);
  return value;
}

// ---------- ElevenLabs: Voiceover und Musik ----------

const ELEVEN = "https://api.elevenlabs.io/v1";

export type Voice = { voice_id: string; name: string; labels: Record<string, string>; preview_url: string | null };

export async function listVoices(): Promise<Voice[]> {
  if (DEMO && !process.env.ELEVENLABS_API_KEY) return [{ voice_id: "demo-voice", name: "Vorschau-Stimme", labels: { language: "de" }, preview_url: null }];
  const data = await readJson<{ voices: Voice[] }>(await fetch(`${ELEVEN}/voices`, { headers: { "xi-api-key": key("elevenlabs") } }), "ElevenLabs");
  return data.voices.map(({ voice_id, name, labels, preview_url }) => ({ voice_id, name, labels: labels ?? {}, preview_url: preview_url ?? null }));
}

async function elevenAudio(path: string, body: unknown, name: string): Promise<MediaItem> {
  const response = await fetch(`${ELEVEN}${path}`, {
    method: "POST",
    headers: { "xi-api-key": key("elevenlabs"), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!response.ok) await readJson(response, "ElevenLabs");
  return storeMedia(new Uint8Array(await response.arrayBuffer()), "audio/mpeg", name);
}

/** Text → Sprache (MP3). Ohne voice_id die Stimme aus der CI-Welt oder die erste verfügbare. */
export async function voiceover(text: string, voiceId?: string): Promise<MediaItem> {
  if (DEMO && !process.env.ELEVENLABS_API_KEY) return storeMedia(new Uint8Array(0), "audio/mpeg", "voiceover");
  const voice = voiceId || (await listVoices())[0]?.voice_id;
  if (!voice) throw new Error("Keine ElevenLabs-Stimme gefunden");
  return elevenAudio(`/text-to-speech/${encodeURIComponent(voice)}`, { text: text.slice(0, 5000), model_id: process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2" }, "voiceover");
}

/** Musik aus einer Beschreibung (z. B. „ruhiger Lo-Fi-Beat, 20 Sekunden“) */
export async function music(prompt: string, seconds = 20): Promise<MediaItem> {
  if (DEMO && !process.env.ELEVENLABS_API_KEY) return storeMedia(new Uint8Array(0), "audio/mpeg", "musik");
  const ms = Math.min(Math.max(Math.round(seconds), 5), 300) * 1000;
  return elevenAudio("/music", { prompt: prompt.slice(0, 2000), music_length_ms: ms }, "musik");
}

// ---------- Whisper: Transkript und Untertitel ----------

export type SubtitleFormat = "srt" | "vtt" | "text";

/** Transkript eines Videos/Audios aus dem Intranet-Storage. OpenAI nimmt bis
 * 25 MB; längere Videos vorher mit Creatomate kürzen oder nur die Tonspur rendern. */
export async function transcribe(path: string, format: SubtitleFormat = "srt", language = "de") {
  if (DEMO && !process.env.OPENAI_API_KEY) return { format, text: "1\n00:00:00,000 --> 00:00:02,000\nVorschau ohne OpenAI\n" };
  const file = await readMedia(path);
  if (!file) throw new Error("Datei nicht gefunden");
  if (file.bytes.byteLength > 25 * 1024 * 1024) throw new Error("Datei größer als 25 MB: vorher kürzen oder Tonspur rendern");
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(file.bytes)], { type: file.mime }), path.split("/").pop());
  form.append("model", "whisper-1");
  form.append("response_format", format);
  form.append("language", language);
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key("whisper")}` },
    body: form,
  });
  if (!response.ok) await readJson(response, "Whisper");
  return { format, text: await response.text() };
}

// ---------- Creatomate: Rendern, Schneiden, Motion Design ----------

const CREATOMATE = "https://api.creatomate.com/v1";

const creatomate = async <T>(path: string, init: RequestInit = {}) =>
  readJson<T>(
    await fetch(`${CREATOMATE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key("creatomate")}`, "Content-Type": "application/json", ...init.headers },
    }),
    "Creatomate"
  );

export type Template = { id: string; name: string; tags: string[] };

export async function listTemplates(): Promise<Template[]> {
  if (DEMO && !process.env.CREATOMATE_API_KEY) return [{ id: "demo-template", name: "Reel 9:16 mit Untertiteln", tags: ["reel"] }];
  const data = await creatomate<{ id: string; name: string; tags?: string[] }[]>("/templates");
  return data.map((t) => ({ id: t.id, name: t.name, tags: t.tags ?? [] }));
}

export type RenderInput = {
  /** Vorlage aus Creatomate (Motion Design im Editor gebaut) … */
  template_id?: string;
  /** … oder frei als RenderScript (z. B. Schnitt: Video mit trim_start/trim_duration) */
  source?: Record<string, unknown>;
  /** Platzhalter der Vorlage füllen, z. B. { "Headline.text": "…", "Video.source": url } */
  modifications?: Record<string, unknown>;
  /** jpg/png für Standbilder, sonst mp4 */
  output_format?: "mp4" | "gif" | "jpg" | "png";
};

export type RenderStatus = { id: string; status: string; url: string | null; error: string | null };

const demoRenders = new Map<string, RenderStatus>();

/** Rendern starten; Creatomate braucht Sekunden bis Minuten. Status über renderStatus(). */
export async function startRender(input: RenderInput): Promise<RenderStatus> {
  if (!input.template_id && !input.source) throw new Error("template_id oder source angeben");
  if (DEMO && !process.env.CREATOMATE_API_KEY) {
    const render = { id: `demo-render-${Date.now()}`, status: "succeeded", url: null, error: null };
    demoRenders.set(render.id, render);
    return render;
  }
  const body = {
    ...(input.template_id ? { template_id: input.template_id } : { source: input.source }),
    ...(input.modifications ? { modifications: input.modifications } : {}),
    ...(input.output_format ? { output_format: input.output_format } : {}),
  };
  const [render] = await creatomate<{ id: string; status: string; url?: string; error_message?: string }[]>("/renders", { method: "POST", body: JSON.stringify(body) });
  return { id: render.id, status: render.status, url: render.url ?? null, error: render.error_message ?? null };
}

export async function renderStatus(id: string): Promise<RenderStatus> {
  if (DEMO && !process.env.CREATOMATE_API_KEY) return demoRenders.get(id) ?? { id, status: "failed", url: null, error: "Unbekannt" };
  const render = await creatomate<{ id: string; status: string; url?: string; error_message?: string }>(`/renders/${encodeURIComponent(id)}`);
  return { id: render.id, status: render.status, url: render.url ?? null, error: render.error_message ?? null };
}

/** Fertiges Rendering ins Intranet holen, damit es gepostet werden kann */
export async function storeRender(render: RenderStatus): Promise<MediaItem | null> {
  if (render.status !== "succeeded" || !render.url) return null;
  return storeFromUrl(render.url, `video-${render.id}`);
}
