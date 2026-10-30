import "server-only";
import { CallAutomationClient } from "@azure/communication-call-automation";
import { db, sb } from "./db";
import { meetEnabled } from "./meet";

// Aufnahme und Auswertung der Calls unter meet.grid-agency.de:
// 1. Sobald jemand im Call ist, startet der Server die Tonaufnahme (ACS Call
//    Recording, mp3, gemischt) für die serverCallId.
// 2. Ist die Datei fertig, schickt Azure Event Grid „RecordingFileStatus-
//    Updated“ an /api/webhooks/acs. Wir laden die Datei, transkribieren sie
//    mit Azure AI Speech (Fast Transcription, Sprechererkennung) und löschen
//    sie danach bei Azure.
// 3. Azure OpenAI fasst zusammen und schlägt Aufgaben vor; die landen in
//    Aufgaben → Aus Calls zur Freigabe.

/** Aufnahme läuft nur, wenn auch Transkript und Auswertung eingerichtet sind */
export const recordingEnabled = () =>
  meetEnabled() &&
  !!process.env.AZURE_SPEECH_KEY &&
  !!(process.env.AZURE_SPEECH_ENDPOINT || process.env.AZURE_SPEECH_REGION) &&
  !!process.env.AZURE_OPENAI_ENDPOINT &&
  !!process.env.AZURE_OPENAI_API_KEY &&
  !!process.env.AZURE_OPENAI_DEPLOYMENT;

const automation = () => new CallAutomationClient(process.env.ACS_CONNECTION_STRING!);

type Chunk = { contentLocation: string; deleteLocation?: string; index?: number };
type Phrase = { speaker: number | null; offset_ms: number; duration_ms: number; text: string };
type Proposal = { title: string; notes: string; owner: "grid" | "kunde"; due_on: string | null };

/** Startet die Aufnahme für einen Anruf, höchstens einmal je serverCallId */
export async function startRecording(meetingId: string, serverCallId: string) {
  if (!recordingEnabled()) return { recording: false };
  const { data: existing } = await sb().from("meeting_recordings").select("id, recording_id").eq("server_call_id", serverCallId).maybeSingle();
  if (existing?.recording_id) return { recording: true };
  let id = existing?.id as string | undefined;
  if (!id) {
    const { data, error } = await sb()
      .from("meeting_recordings")
      .upsert({ meeting_id: meetingId, server_call_id: serverCallId }, { onConflict: "server_call_id", ignoreDuplicates: true })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Jemand anderes hat gerade gestartet
    if (!data) return { recording: true };
    id = data.id as string;
  }
  try {
    const result = await automation()
      .getCallRecording()
      .start({ callLocator: { id: serverCallId, kind: "serverCallLocator" }, recordingContent: "audio", recordingChannel: "mixed", recordingFormat: "mp3" });
    await db().update("meeting_recordings", id, { recording_id: result.recordingId, status: "laeuft", error: null });
    return { recording: true };
  } catch (error) {
    console.error(error);
    await db().update("meeting_recordings", id, { status: "fehler", error: `Aufnahme nicht gestartet: ${(error as Error).message}` });
    return { recording: false };
  }
}

/** Event Grid: Aufnahmedatei ist fertig. Liefert die ID der Aufnahme, die
 * ausgewertet werden soll (oder null, wenn schon erledigt/unbekannt). */
export async function recordingReady(event: { subject?: string; data?: Record<string, unknown> }) {
  const serverCallId = event.subject?.split("/serverCallId/")[1];
  if (!serverCallId) return null;
  const info = event.data?.recordingStorageInfo as { recordingChunks?: Chunk[] } | undefined;
  const chunks = (info?.recordingChunks ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  if (!chunks.length) return null;
  // Nur einmal auswerten, auch wenn Event Grid das Event wiederholt
  const { data } = await sb()
    .from("meeting_recordings")
    .update({ status: "verarbeitung", duration_ms: Number(event.data?.recordingDurationMs) || null, chunks })
    .eq("server_call_id", serverCallId)
    .in("status", ["laeuft", "fehler"])
    .is("processed_at", null)
    .select("id")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function download(location: string) {
  const stream = await automation().getCallRecording().downloadStreaming(location);
  const parts: Buffer[] = [];
  for await (const part of stream as AsyncIterable<Buffer | string>) parts.push(typeof part === "string" ? Buffer.from(part) : part);
  return Buffer.concat(parts);
}

async function transcribe(audio: Buffer): Promise<{ phrases: Phrase[]; duration_ms: number }> {
  const base = process.env.AZURE_SPEECH_ENDPOINT?.replace(/\/$/, "") ?? `https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com`;
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "call.mp3");
  form.append("definition", JSON.stringify({ locales: ["de-DE"], diarization: { enabled: true, maxSpeakers: 6 }, profanityFilterMode: "None" }));
  const response = await fetch(`${base}/speechtotext/transcriptions:transcribe?api-version=2024-11-15`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY! },
    body: form,
  });
  if (!response.ok) throw new Error(`Azure Speech antwortet mit ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result = (await response.json()) as {
    durationMilliseconds?: number;
    phrases?: { speaker?: number; offsetMilliseconds: number; durationMilliseconds: number; text: string }[];
  };
  return {
    duration_ms: result.durationMilliseconds ?? 0,
    phrases: (result.phrases ?? []).map((p) => ({ speaker: p.speaker ?? null, offset_ms: p.offsetMilliseconds, duration_ms: p.durationMilliseconds, text: p.text })),
  };
}

const SYSTEM = `Du wertest Transkripte von Video-Calls der Social-Media-Agentur GRID AGENCY aus (Erstgespräche, Kick-offs, Jour fixe und andere Kunden-Calls, Vorstellungsgespräche).
Antworte auf Deutsch, du-Form, sachlich.

summary: 3 bis 6 Sätze: Worum ging es, was wurde entschieden, was ist offen.
tasks: alle konkreten, umsetzbaren Aufgaben, die im Call vereinbart oder klar nötig wurden. Keine allgemeinen Absichten, keine Doppelungen.
- title: kurz und im Imperativ, z. B. „Content-Plan für Dezember schicken“ (max. 80 Zeichen)
- notes: Kontext aus dem Call, damit jemand ohne Call die Aufgabe erledigen kann (Details, Wünsche, Zitate)
- owner: "grid", wenn GRID es erledigt; "kunde", wenn der Kunde oder die Gesprächspartner*in etwas liefern oder tun muss
- due_on: Datum als YYYY-MM-DD nur, wenn im Call ein Termin genannt wurde (relativ zum Call-Datum auflösen), sonst null
Die Sprecher sind nummeriert (Sprecher 1, 2, …); ordne sie über den Inhalt den Teilnehmenden zu. Erfinde nichts, was nicht im Transkript steht.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "tasks"],
  properties: {
    summary: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "notes", "owner", "due_on"],
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
          owner: { type: "string", enum: ["grid", "kunde"] },
          due_on: { type: ["string", "null"] },
        },
      },
    },
  },
};

async function evaluate(context: string, phrases: Phrase[]): Promise<{ summary: string; tasks: Proposal[] }> {
  const transcript = phrases.map((p) => `[${p.speaker ? `Sprecher ${p.speaker}` : "?"}] ${p.text}`).join("\n");
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
  const response = await fetch(
    `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21"}`,
    {
      method: "POST",
      headers: { "api-key": process.env.AZURE_OPENAI_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${context}\n\nTranskript:\n${transcript}` },
        ],
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: { name: "call_auswertung", strict: true, schema: SCHEMA } },
      }),
    }
  );
  if (!response.ok) throw new Error(`Azure OpenAI antwortet mit ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result = (await response.json()) as { choices: { message: { content: string } }[] };
  const parsed = JSON.parse(result.choices[0].message.content) as { summary: string; tasks: Proposal[] };
  return {
    summary: parsed.summary,
    tasks: parsed.tasks.map((t) => ({ ...t, due_on: t.due_on && /^\d{4}-\d{2}-\d{2}$/.test(t.due_on) ? t.due_on : null })),
  };
}

const dateDe = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Passendes Kundenprojekt in Aufgaben (über Kunde oder Lead des Raums) */
async function projectFor(meeting: Record<string, unknown>) {
  let customerId = meeting.customer_id as string | null;
  if (!customerId && meeting.lead_id) customerId = ((await db().get("leads", String(meeting.lead_id)))?.customer_id as string | null) ?? null;
  if (!customerId) return null;
  const { data } = await sb().from("task_projects").select("id").eq("customer_id", customerId).eq("archived", false).order("position").limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Datei laden, transkribieren, bei Azure löschen, auswerten, Vorschläge anlegen */
export async function processRecording(recordingId: string) {
  const recording = await db().get("meeting_recordings", recordingId);
  if (!recording) return;
  try {
    const chunks = (recording.chunks as Chunk[] | null) ?? [];
    const phrases: Phrase[] = [];
    let offset = 0;
    for (const chunk of chunks) {
      const part = await transcribe(await download(chunk.contentLocation));
      phrases.push(...part.phrases.map((p) => ({ ...p, offset_ms: p.offset_ms + offset })));
      offset += part.duration_ms;
    }
    // Tonaufnahme nicht aufheben, nur das Transkript
    for (const chunk of chunks) {
      if (chunk.deleteLocation) await automation().getCallRecording().delete(chunk.deleteLocation).catch((e) => console.error(e));
    }

    const meeting = (await db().get("meetings", String(recording.meeting_id)))!;
    const names = ((meeting.participants as { name: string }[] | null) ?? []).map((p) => p.name);
    // Jour fixe: ein Raum für die ganze Serie, jeder Termin ist ein eigener
    // Anruf. Das Datum kommt deshalb aus der Aufnahme, nicht aus dem Raum.
    const series = !!meeting.recurrence;
    const callDate = dateDe(String(series ? recording.created_at : meeting.starts_at));
    const context = [
      series ? `Call: ${meeting.title} (Jour fixe vom ${callDate})` : `Call: ${meeting.title}`,
      `Datum: ${callDate}`,
      `Teilnehmende: ${[...new Set([meeting.host_name, ...names].filter(Boolean))].join(", ") || "unbekannt"}`,
    ].join("\n");
    const result = phrases.length ? await evaluate(context, phrases) : { summary: "Im Call wurde nichts gesagt, das sich transkribieren ließ.", tasks: [] };

    const project = await projectFor(meeting);
    const now = Date.now() / 1000;
    if (result.tasks.length) {
      const { error } = await sb()
        .from("meeting_tasks")
        .insert(result.tasks.map((t, i) => ({ recording_id: recordingId, ...t, project_id: project, position: now + i })));
      if (error) throw new Error(error.message);
    }
    await db().update("meeting_recordings", recordingId, {
      status: "fertig",
      error: null,
      transcript: { phrases },
      chunks: null,
      summary: result.summary,
      processed_at: new Date().toISOString(),
    });
    if (meeting.lead_id) {
      await db().insert("lead_activities", {
        lead_id: meeting.lead_id,
        kind: "notiz",
        author: "Meet",
        body: `Zusammenfassung „${meeting.title}“:\n${result.summary}${result.tasks.length ? `\n\n${result.tasks.length} Aufgaben vorgeschlagen (Aufgaben → Aus Calls).` : ""}`,
      });
    }
  } catch (error) {
    console.error(error);
    await db().update("meeting_recordings", recordingId, { status: "fehler", error: (error as Error).message.slice(0, 500) });
  }
}
