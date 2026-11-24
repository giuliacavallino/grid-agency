import "server-only";
import { CallAutomationClient } from "@azure/communication-call-automation";
import { db, sb } from "./db";
import { meetEnabled } from "./meet";

// Aufnahme und Auswertung der Calls unter meet.grid-agency.de:
// 1. Sobald der Call steht, übernimmt ein Browser im Call die Aufnahme
//    (claimRecorder): Er mischt eigenes Mikro und alle anderen und lädt den
//    Ton alle 30 Sekunden hoch (storePart, Bucket meet-audio). Verlässt er
//    den Call, übernimmt ein anderer Browser.
// 2. Endet der Call (letzte Person geht) oder kommt 5 Minuten nichts mehr
//    (Cron /api/cron/aufnahmen), werden die Teile zusammengesetzt und mit
//    Azure AI Speech (Fast Transcription, Sprechererkennung) transkribiert;
//    danach wird der Ton gelöscht.
// 3. Azure OpenAI fasst zusammen und schlägt Aufgaben vor; die landen im
//    Kundenprojekt unter Aufgaben → Aus Calls, dazu die Follow-up-Mail.
// Früher lief die Aufnahme über ACS Call Recording + Event Grid; der Weg
// (startRecording/recordingReady) bleibt für alte Aufnahmen bestehen.

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

// ---------- Aufnahme im Browser ----------

const BUCKET = "meet-audio";
/** Ohne neuen Teil so lange gilt der aufnehmende Browser als weg */
const TAKEOVER_MS = 90_000;
/** Ohne neuen Teil so lange gilt der Call als beendet (Cron) */
export const STALE_MS = 5 * 60_000;
const MAX_PARTS = 600; // 5 Stunden à 30 Sekunden
const MAX_PART_BYTES = 4 * 1024 * 1024;
const SEGMENT = /^[a-z0-9-]{6,40}$/;

export class RecordingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type BrowserRecording = { id: string; meeting_id: string; status: string; recorder: string | null; parts: number; last_chunk_at: string | null; source: string };

/** Ein Browser bewirbt sich als Aufnehmender. Zusage, wenn niemand aufnimmt
 * oder der bisherige seit TAKEOVER_MS nichts mehr geschickt hat. */
export async function claimRecorder(meetingId: string, serverCallId: string, segment: string) {
  if (!recordingEnabled()) return { recording: false as const };
  if (!SEGMENT.test(segment)) throw new RecordingError("Ungültige Sitzung");
  const select = () => sb().from("meeting_recordings").select("id,meeting_id,status,recorder,parts,last_chunk_at,source").eq("server_call_id", serverCallId).maybeSingle();
  let row = (await select()).data as BrowserRecording | null;
  if (!row) {
    const { data } = await sb()
      .from("meeting_recordings")
      .upsert(
        { meeting_id: meetingId, server_call_id: serverCallId, source: "browser", status: "laeuft", recorder: segment, chunks: [], last_chunk_at: new Date().toISOString() },
        { onConflict: "server_call_id", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();
    if (data) return { recording: true as const, id: data.id as string, recorder: true };
    row = (await select()).data as BrowserRecording | null;
    if (!row) throw new RecordingError("Aufnahme nicht angelegt", 500);
  }
  if (row.meeting_id !== meetingId) throw new RecordingError("Falscher Raum", 403);
  if (row.status !== "laeuft") return { recording: true as const, id: row.id, recorder: false };
  if (row.recorder === segment) return { recording: true as const, id: row.id, recorder: true };
  const free = !row.recorder || !row.last_chunk_at || Date.now() - Date.parse(row.last_chunk_at) > TAKEOVER_MS;
  if (!free) return { recording: true as const, id: row.id, recorder: false };
  // Übernehmen, nur wenn sich zwischendurch nichts geändert hat
  let update = sb().from("meeting_recordings").update({ recorder: segment, source: "browser", chunks: [], last_chunk_at: new Date().toISOString() }).eq("id", row.id).eq("status", "laeuft");
  update = row.recorder ? update.eq("recorder", row.recorder) : update.is("recorder", null);
  const { data } = await update.select("id").maybeSingle();
  return { recording: true as const, id: row.id, recorder: !!data };
}

async function browserRow(id: string, meetingId: string) {
  const { data } = await sb().from("meeting_recordings").select("id,meeting_id,status,recorder,parts,last_chunk_at,source").eq("id", id).maybeSingle();
  const row = data as BrowserRecording | null;
  if (!row || row.meeting_id !== meetingId) throw new RecordingError("Aufnahme nicht gefunden", 404);
  return row;
}

/** Ein Teil (30 Sekunden) vom aufnehmenden Browser */
export async function storePart(id: string, meetingId: string, segment: string, index: number, audio: Buffer, contentType: string) {
  const row = await browserRow(id, meetingId);
  if (row.status !== "laeuft") throw new RecordingError("Aufnahme ist beendet", 409);
  if (row.recorder !== segment) throw new RecordingError("Ein anderer Browser nimmt auf", 409);
  if (!Number.isInteger(index) || index < 0 || index >= MAX_PARTS) throw new RecordingError("Ungültiger Teil");
  if (!audio.length || audio.length > MAX_PART_BYTES) throw new RecordingError("Teil zu groß");
  const type = contentType.startsWith("audio/mp4") ? "audio/mp4" : "audio/webm";
  const { error } = await sb()
    .storage.from(BUCKET)
    .upload(`${id}/${segment}/${String(index).padStart(5, "0")}.${type === "audio/mp4" ? "m4a" : "webm"}`, audio, { contentType: type, upsert: true });
  if (error) throw new RecordingError(`Speichern fehlgeschlagen: ${error.message}`, 500);
  await sb().from("meeting_recordings").update({ parts: row.parts + 1, last_chunk_at: new Date().toISOString() }).eq("id", id);
}

/** Aufnehmender Browser verlässt den Call: frei für andere, oder (als
 * Letzte*r im Call) Aufnahme abschließen. Liefert die ID zum Auswerten. */
export async function releaseRecorder(id: string, meetingId: string, segment: string, end: boolean) {
  const row = await browserRow(id, meetingId);
  if (row.status !== "laeuft" || row.recorder !== segment) return null;
  if (!end) {
    await sb().from("meeting_recordings").update({ recorder: null }).eq("id", id).eq("recorder", segment);
    return null;
  }
  return startProcessing(id);
}

/** Aufnahme zur Auswertung sperren (nur einmal) */
async function startProcessing(id: string) {
  const { data } = await sb().from("meeting_recordings").update({ status: "verarbeitung", recorder: null }).eq("id", id).eq("status", "laeuft").select("id,parts").maybeSingle();
  if (!data) return null;
  if (!data.parts) {
    await db().update("meeting_recordings", id, { status: "fehler", error: "Es kam kein Ton an (Mikrofon-Freigabe im Browser?)." });
    return null;
  }
  return id;
}

/** Cron: Browser-Aufnahmen, zu denen seit STALE_MS nichts mehr kam (Tab
 * geschlossen, Verbindung weg), abschließen */
export async function staleRecordings() {
  const { data } = await sb()
    .from("meeting_recordings")
    .select("id")
    .eq("source", "browser")
    .eq("status", "laeuft")
    .lt("last_chunk_at", new Date(Date.now() - STALE_MS).toISOString())
    .limit(3);
  const ids: string[] = [];
  for (const row of (data ?? []) as { id: string }[]) {
    const id = await startProcessing(row.id);
    if (id) ids.push(id);
  }
  return ids;
}

/** Teile je Segment in Reihenfolge, zusammengesetzt zu einer Datei je Segment */
async function browserAudio(id: string) {
  const storage = sb().storage.from(BUCKET);
  const { data: segments, error } = await storage.list(id, { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(error.message);
  const files: { audio: Buffer; type: string; name: string }[] = [];
  const paths: string[] = [];
  for (const segment of segments ?? []) {
    const { data: parts } = await storage.list(`${id}/${segment.name}`, { limit: 1000, sortBy: { column: "name", order: "asc" } });
    const buffers: Buffer[] = [];
    let mp4 = false;
    for (const part of parts ?? []) {
      const path = `${id}/${segment.name}/${part.name}`;
      const { data: blob, error: downloadError } = await storage.download(path);
      if (downloadError || !blob) throw new Error(`Teil ${path} fehlt: ${downloadError?.message ?? ""}`);
      buffers.push(Buffer.from(await blob.arrayBuffer()));
      paths.push(path);
      mp4 ||= part.name.endsWith(".m4a");
    }
    if (buffers.length) files.push({ audio: Buffer.concat(buffers), type: mp4 ? "audio/mp4" : "audio/webm", name: mp4 ? "call.m4a" : "call.webm" });
  }
  // Segmente sind Ordner: Startzeit vorne im Namen, daher schon sortiert
  return { files, remove: () => (paths.length ? storage.remove(paths) : Promise.resolve()) };
}

async function download(location: string) {
  const stream = await automation().getCallRecording().downloadStreaming(location);
  const parts: Buffer[] = [];
  for await (const part of stream as AsyncIterable<Buffer | string>) parts.push(typeof part === "string" ? Buffer.from(part) : part);
  return Buffer.concat(parts);
}

async function transcribe(audio: Buffer, file = { type: "audio/mpeg", name: "call.mp3" }): Promise<{ phrases: Phrase[]; duration_ms: number }> {
  const base = process.env.AZURE_SPEECH_ENDPOINT?.replace(/\/$/, "") ?? `https://${process.env.AZURE_SPEECH_REGION}.api.cognitive.microsoft.com`;
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: file.type }), file.name);
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

/** Azure OpenAI mit festem JSON-Schema */
async function chatJson<T>(system: string, user: string, name: string, schema: object, temperature = 0.2): Promise<T> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
  const response = await fetch(
    `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21"}`,
    {
      method: "POST",
      headers: { "api-key": process.env.AZURE_OPENAI_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      }),
    }
  );
  if (!response.ok) throw new Error(`Azure OpenAI antwortet mit ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const result = (await response.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(result.choices[0].message.content) as T;
}

const transcriptText = (phrases: Phrase[]) => phrases.map((p) => `[${p.speaker ? `Sprecher ${p.speaker}` : "?"}] ${p.text}`).join("\n");

async function evaluate(context: string, phrases: Phrase[]): Promise<{ summary: string; tasks: Proposal[] }> {
  const parsed = await chatJson<{ summary: string; tasks: Proposal[] }>(SYSTEM, `${context}\n\nTranskript:\n${transcriptText(phrases)}`, "call_auswertung", SCHEMA);
  return {
    summary: parsed.summary,
    tasks: parsed.tasks.map((t) => ({ ...t, due_on: t.due_on && /^\d{4}-\d{2}-\d{2}$/.test(t.due_on) ? t.due_on : null })),
  };
}

const dateDe = (iso: string) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));

/** Titel, Datum und Teilnehmende für die Auswertung. Jour fixe: ein Raum
 * für die ganze Serie, jeder Termin ist ein eigener Anruf. Das Datum kommt
 * deshalb aus der Aufnahme, nicht aus dem Raum. */
function callContext(meeting: Record<string, unknown>, recording: Record<string, unknown>) {
  const names = ((meeting.participants as { name: string }[] | null) ?? []).map((p) => p.name);
  const series = !!meeting.recurrence;
  const callDate = dateDe(String(series ? recording.created_at : meeting.starts_at));
  return [
    series ? `Call: ${meeting.title} (Jour fixe vom ${callDate})` : `Call: ${meeting.title}`,
    `Datum: ${callDate}`,
    `Teilnehmende: ${[...new Set([meeting.host_name, ...names].filter(Boolean))].join(", ") || "unbekannt"}`,
  ].join("\n");
}

const FOLLOW_UP_SYSTEM = `Du schreibst für die Social-Media-Agentur GRID AGENCY die Follow-up-Mail an den Kunden nach einem Call (meist Jour fixe).
Deutsch, freundlich, klar, ohne Floskeln. Anrede wie im Call: Duzt man sich im Transkript, dann du, sonst Sie; im Zweifel du mit Vornamen. Ist der Vorname der Kundin bzw. des Kunden nicht sicher, „Hallo zusammen,“.
Aufbau (reiner Text, keine Markdown-Sternchen, Listen mit „– “):
1. Anrede und ein Satz Dank für den Call.
2. „Kurz zusammengefasst:“ mit den wichtigsten Punkten und Entscheidungen (3 bis 6 Punkte).
3. „Das übernehmen wir:“ mit den Aufgaben von GRID, jeweils mit Termin, wenn einer genannt ist.
4. „Von euch bzw. Ihnen brauchen wir:“ mit den Aufgaben des Kunden (passend zur Anrede), nur wenn es welche gibt.
5. Nächster Termin, wenn bekannt (bei Jour fixe: nächste Woche zur gewohnten Zeit).
6. Ein kurzer Schlusssatz (z. B. dass man sich bei Fragen gern meldet). Keine Grußformel und kein Name: die Signatur hängt das Mailprogramm an.
subject: kurz, z. B. „Zusammenfassung Jour fixe vom 24.11.“
Erfinde nichts, was nicht im Call oder in den Aufgaben steht. Interne Themen (Preise anderer Kunden, Kritik am Kunden, Interna) gehören nicht in die Mail.`;

const FOLLOW_UP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: { subject: { type: "string" }, body: { type: "string" } },
};

export type FollowUp = { subject: string; body: string; created_at: string };

/** Follow-up-Mail an den Kunden aus Zusammenfassung, Aufgaben und Transkript
 * schreiben und an der Aufnahme speichern */
export async function writeFollowUp(recordingId: string): Promise<FollowUp> {
  const recording = await db().get("meeting_recordings", recordingId);
  if (!recording?.summary) throw new Error("Der Call ist noch nicht ausgewertet");
  const meeting = (await db().get("meetings", String(recording.meeting_id)))!;
  const { data } = await sb().from("meeting_tasks").select("title,notes,owner,due_on,status").eq("recording_id", recordingId).order("position");
  const tasks = ((data ?? []) as (Proposal & { status: string })[]).filter((t) => t.status !== "verworfen");
  const phrases = ((recording.transcript as { phrases?: Phrase[] } | null)?.phrases ?? []) as Phrase[];
  const input = [
    callContext(meeting, recording),
    `\nZusammenfassung:\n${recording.summary}`,
    `\nAufgaben:\n${tasks.map((t) => `– [${t.owner === "kunde" ? "Kunde" : "GRID"}] ${t.title}${t.due_on ? ` (bis ${t.due_on})` : ""}${t.notes ? `: ${t.notes}` : ""}`).join("\n") || "keine"}`,
    // Das Transkript nur für Anrede und Details, gekürzt
    phrases.length ? `\nTranskript (Auszug):\n${transcriptText(phrases).slice(0, 60_000)}` : "",
  ].join("\n");
  const mail = await chatJson<{ subject: string; body: string }>(FOLLOW_UP_SYSTEM, input, "follow_up_mail", FOLLOW_UP_SCHEMA, 0.4);
  const followUp: FollowUp = { subject: mail.subject.trim(), body: mail.body.trim(), created_at: new Date().toISOString() };
  await db().update("meeting_recordings", recordingId, { follow_up: followUp });
  return followUp;
}

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
    const phrases: Phrase[] = [];
    let offset = 0;
    if (recording.source === "browser") {
      const { files, remove } = await browserAudio(recordingId);
      for (const file of files) {
        const part = await transcribe(file.audio, { type: file.type, name: file.name });
        phrases.push(...part.phrases.map((p) => ({ ...p, offset_ms: p.offset_ms + offset })));
        offset += part.duration_ms;
      }
      // Tonaufnahme nicht aufheben, nur das Transkript
      await remove();
    } else {
      const chunks = (recording.chunks as Chunk[] | null) ?? [];
      for (const chunk of chunks) {
        const part = await transcribe(await download(chunk.contentLocation));
        phrases.push(...part.phrases.map((p) => ({ ...p, offset_ms: p.offset_ms + offset })));
        offset += part.duration_ms;
      }
      for (const chunk of chunks) {
        if (chunk.deleteLocation) await automation().getCallRecording().delete(chunk.deleteLocation).catch((e) => console.error(e));
      }
    }

    const meeting = (await db().get("meetings", String(recording.meeting_id)))!;
    const context = callContext(meeting, recording);
    const result = phrases.length ? await evaluate(context, phrases) : { summary: "Im Call wurde nichts gesagt, das sich transkribieren ließ.", tasks: [] };

    const project = await projectFor(meeting);
    const now = Date.now() / 1000;
    if (result.tasks.length) {
      // Mit Kundenprojekt direkt als To-dos übernehmen, sonst zur Auswahl
      // unter Aufgaben → Aus Calls
      const decided = project ? { status: "uebernommen", decided_by: "Automatisch aus dem Call", decided_at: new Date().toISOString() } : {};
      const { data: inserted, error } = await sb()
        .from("meeting_tasks")
        .insert(result.tasks.map((t, i) => ({ recording_id: recordingId, ...t, project_id: project, position: now + i, ...decided })))
        .select("id,title,notes,owner,due_on");
      if (error) throw new Error(error.message);
      if (project) {
        for (const proposal of (inserted ?? []) as (Proposal & { id: string })[]) {
          const task = await db().insert("tasks", {
            project_id: project,
            title: (proposal.owner === "kunde" ? `Kunde: ${proposal.title}` : proposal.title).slice(0, 200),
            notes: proposal.notes || null,
            due_on: proposal.due_on,
            meeting_task_id: proposal.id,
          });
          await db().update("meeting_tasks", proposal.id, { task_id: task.id });
        }
      }
    }
    await db().update("meeting_recordings", recordingId, {
      status: "fertig",
      error: null,
      duration_ms: recording.duration_ms ?? (offset || null),
      transcript: { phrases },
      chunks: null,
      summary: result.summary,
      processed_at: new Date().toISOString(),
    });
    // Follow-up-Mail gleich mitschreiben; scheitert sie, bleibt die Auswertung
    await writeFollowUp(recordingId).catch((e) => console.error(e));
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
