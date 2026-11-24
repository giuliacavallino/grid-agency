"use client";

import type { Call, LocalAudioStream, RemoteAudioStream } from "@azure/communication-calling";

// Aufnahme des Calls im Browser: mischt das eigene Mikrofon (stumm, wenn
// stummgeschaltet) mit dem Ton aller anderen und lädt alle 30 Sekunden einen
// Teil hoch. Pro Call nimmt nur ein Browser auf (Zusage vom Server); die
// anderen fragen regelmäßig nach und übernehmen, wenn er wegfällt. Die
// Auswertung (Transkript, Zusammenfassung, Aufgaben, Follow-up) läuft danach
// auf dem Server.

const SLICE_MS = 30_000;
const CLAIM_EVERY_MS = 20_000;

const pickType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));

type Claim = { recording: boolean; id?: string; recorder?: boolean };

export class CallRecorder {
  private segment = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  private id: string | null = null;
  private serverCallId: string | null = null;
  private recorder: MediaRecorder | null = null;
  private index = 0;
  private queue: Promise<void> = Promise.resolve();
  private claimTimer: number | null = null;
  private stopped = false;
  private nodes: AudioNode[] = [];
  private sinks: HTMLAudioElement[] = [];
  private localGain: GainNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private onMuted = () => this.applyMute();
  private onRemote = () => void this.attachRemote();
  private onLocal = () => void this.attachLocal();

  constructor(
    private code: string,
    private call: Call,
    private context: AudioContext
  ) {}

  /** Nach „Verbunden“: um die Aufnahme bewerben (und später nachfragen) */
  async start() {
    if (!pickType()) return;
    this.serverCallId = await this.call.info.getServerCallId();
    await this.claim();
  }

  private async claim() {
    if (this.stopped || this.recorder) return;
    try {
      const response = await fetch(`/api/meet/${this.code}/aufnahme`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverCallId: this.serverCallId, segment: this.segment }),
      });
      const claim = (await response.json()) as Claim;
      if (!response.ok || !claim.recording) return; // keine Aufnahme für diesen Raum
      this.id = claim.id ?? null;
      if (claim.recorder) await this.begin();
    } catch (error) {
      console.error(error);
    }
    if (!this.stopped && !this.recorder) this.claimTimer = window.setTimeout(() => void this.claim(), CLAIM_EVERY_MS);
  }

  private async begin() {
    const type = pickType()!;
    if (this.context.state === "suspended") await this.context.resume().catch(() => {});
    this.destination = this.context.createMediaStreamDestination();
    this.localGain = this.context.createGain();
    this.localGain.connect(this.destination);
    await this.attachLocal();
    await this.attachRemote();
    this.applyMute();
    this.call.on("isMutedChanged", this.onMuted);
    this.call.on("remoteAudioStreamsUpdated", this.onRemote);
    this.call.on("localAudioStreamsUpdated", this.onLocal);

    const recorder = new MediaRecorder(this.destination.stream, { mimeType: type, audioBitsPerSecond: 32_000 });
    recorder.ondataavailable = (event) => {
      if (event.data.size) this.enqueue(event.data);
    };
    recorder.start(SLICE_MS);
    this.recorder = recorder;
  }

  /** Eigenes Mikrofon (der Stream, den der Call sendet) */
  private async attachLocal() {
    const stream = (this.call.localAudioStreams as ReadonlyArray<LocalAudioStream>)[0];
    if (!stream || !this.localGain) return;
    try {
      const media = await stream.getMediaStream();
      const source = this.context.createMediaStreamSource(media);
      source.connect(this.localGain);
      this.nodes.push(source);
    } catch (error) {
      console.error(error);
    }
  }

  /** Ton aller anderen (vom SDK bereits gemischt) */
  private async attachRemote() {
    if (!this.destination) return;
    for (const stream of this.call.remoteAudioStreams as ReadonlyArray<RemoteAudioStream>) {
      try {
        const media = await stream.getMediaStream();
        // Chrome liefert entfernten WebRTC-Ton erst an Web Audio, wenn er
        // auch an einem (stummen) Audio-Element hängt
        const sink = new Audio();
        sink.muted = true;
        sink.srcObject = media;
        void sink.play().catch(() => {});
        this.sinks.push(sink);
        const source = this.context.createMediaStreamSource(media);
        source.connect(this.destination);
        this.nodes.push(source);
      } catch (error) {
        console.error(error);
      }
    }
  }

  /** Stummgeschaltet heißt auch: nicht aufnehmen */
  private applyMute() {
    if (this.localGain) this.localGain.gain.value = this.call.isMuted ? 0 : 1;
  }

  private enqueue(blob: Blob) {
    const index = this.index++;
    this.queue = this.queue.then(() => this.upload(blob, index));
  }

  private async upload(blob: Blob, index: number) {
    if (!this.id) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`/api/meet/${this.code}/aufnahme/${this.id}?segment=${this.segment}&index=${index}`, {
          method: "POST",
          headers: { "Content-Type": blob.type || "audio/webm" },
          body: blob,
        });
        if (response.ok) return;
        // Ein anderer Browser hat übernommen oder die Aufnahme ist beendet
        if (response.status === 409) {
          this.teardown();
          return;
        }
      } catch {
        // Netz weg: gleich nochmal
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }

  private teardown() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.stop();
    }
    this.recorder = null;
    this.call.off("isMutedChanged", this.onMuted);
    this.call.off("remoteAudioStreamsUpdated", this.onRemote);
    this.call.off("localAudioStreamsUpdated", this.onLocal);
    this.nodes.forEach((node) => node.disconnect());
    this.nodes = [];
    this.sinks.forEach((sink) => (sink.srcObject = null));
    this.sinks = [];
    this.localGain?.disconnect();
    this.localGain = null;
    this.destination = null;
  }

  /** Call verlassen: letzten Teil hochladen; als letzte Person im Call die
   * Aufnahme abschließen (Auswertung startet), sonst für andere freigeben */
  async stop(lastInCall: boolean) {
    this.stopped = true;
    if (this.claimTimer) window.clearTimeout(this.claimTimer);
    const recorder = this.recorder;
    if (!recorder || !this.id) return;
    if (recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    }
    await this.queue;
    this.teardown();
    await fetch(`/api/meet/${this.code}/aufnahme/${this.id}/ende`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment: this.segment, end: lastInCall }),
      keepalive: true,
    }).catch(() => {});
  }

  /** Tab wird geschlossen: nur freigeben (der Server schließt sonst nach
   * 5 Minuten ohne Ton selbst ab) */
  release() {
    if (!this.recorder || !this.id) return;
    navigator.sendBeacon(`/api/meet/${this.code}/aufnahme/${this.id}/ende`, new Blob([JSON.stringify({ segment: this.segment, end: false })], { type: "text/plain" }));
  }
}
