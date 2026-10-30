"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type {
  Call,
  CallAgent,
  CallClient,
  LocalVideoStream,
  RemoteParticipant,
  RemoteVideoStream,
  VideoDeviceInfo,
  VideoStreamRenderer,
} from "@azure/communication-calling";
import { CalendarClock, Mic, MicOff, MonitorUp, PhoneOff, Users, Video, VideoOff } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { Avatar, Button, Input, Spinner } from "@/components/ui";
import { MeetMark, MeetShell } from "./brand";
import { CallDone } from "./done";
import { WaitingStage } from "./waiting";

// Video-Call unter meet.grid-agency.de/<code> mit Azure Communication
// Services: Vorschau mit Kamera und Mikro, Name eintragen, beitreten. Das
// SDK läuft nur im Browser und wird erst hier nachgeladen.

/** recording: Calls werden aufgezeichnet und transkribiert (Hinweis unter „Jetzt beitreten“) */
type View = { title: string; starts_at: string; ends_at: string; host_name: string | null; recording?: boolean };
type Phase = "lobby" | "joining" | "call" | "left";

const TZ = "Europe/Berlin";
const day = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

type Sdk = typeof import("@azure/communication-calling");
let sdkPromise: Promise<Sdk> | null = null;
const loadSdk = () => (sdkPromise ??= import("@azure/communication-calling"));

const NAME_KEY = "grid-meet-name";

/** Bild eines lokalen oder entfernten Videostreams */
function StreamView({ stream, mirrored, fit }: { stream: LocalVideoStream | RemoteVideoStream; mirrored?: boolean; fit?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let renderer: VideoStreamRenderer | null = null;
    let cancelled = false;
    loadSdk()
      .then(async (sdk) => {
        if (cancelled) return;
        renderer = new sdk.VideoStreamRenderer(stream);
        const view = await renderer.createView({ isMirrored: mirrored, scalingMode: fit ? "Fit" : "Crop" });
        if (!cancelled) ref.current?.replaceChildren(view.target);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
      renderer?.dispose();
    };
  }, [stream, mirrored, fit]);
  return <div ref={ref} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&>div]:h-full" />;
}

function ControlButton({ label, active = true, danger, onClick, children }: { label: string; active?: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={danger ? undefined : !active}
      title={label}
      className={clsx(
        "grid h-12 w-12 place-items-center rounded-full transition-[transform,background-color] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow",
        danger ? "bg-error text-sky hover:bg-error/85" : active ? "border border-snow/15 bg-snow/[0.08] text-snow hover:bg-snow/[0.16]" : "bg-snow text-sky hover:bg-snow/85"
      )}
    >
      {children}
    </button>
  );
}

function Tile({ participant, className }: { participant: RemoteParticipant; className?: string }) {
  const name = participant.displayName || "Gast";
  const video = participant.videoStreams.find((s) => s.mediaStreamType === "Video" && s.isAvailable);
  return (
    <div className={clsx("relative min-h-0 overflow-hidden rounded-2xl bg-surface ring-2 ring-transparent transition-shadow", participant.isSpeaking && "ring-success", className)}>
      {video ? (
        <StreamView key={video.id} stream={video} />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar name={name} className="h-20 w-20 text-2xl" />
        </div>
      )}
      <span className="absolute bottom-2 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1.5 truncate rounded-full bg-sky/75 px-2.5 py-1 text-xs font-medium text-snow backdrop-blur">
        {participant.isMuted && <MicOff className="h-3.5 w-3.5 shrink-0" aria-label="stumm" />}
        {name}
      </span>
    </div>
  );
}

export function MeetRoom({ code }: { code: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [ended, setEnded] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [name, setName] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [camera, setCamera] = useState<LocalVideoStream | null>(null);
  const [devicesReady, setDevicesReady] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const client = useRef<CallClient | null>(null);
  const agent = useRef<CallAgent | null>(null);
  const cameraInfo = useRef<VideoDeviceInfo | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    fetch(`/api/meet/${code}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 410) setGone(true);
        if (!response.ok) throw new Error(data.error ?? "Diesen Link gibt es nicht.");
        setView(data);
      })
      .catch((e: Error) => setError(e.message));
    try {
      const saved = localStorage.getItem(NAME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- gemerkter Name erst im Browser verfügbar
      if (saved) setName(saved);
    } catch {
      // ohne Speicher eben leer
    }
  }, [code]);

  // Kamera und Mikro freigeben lassen, Vorschau starten
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sdk = await loadSdk();
      client.current ??= new sdk.CallClient();
      const devices = await client.current.getDeviceManager();
      const access = await devices.askDevicePermission({ audio: true, video: true });
      if (cancelled) return;
      if (!access.audio) setDeviceError("Kein Zugriff aufs Mikrofon. Erlaube ihn im Browser, damit man dich hört.");
      const [first] = access.video ? await devices.getCameras() : [];
      if (cancelled) return;
      cameraInfo.current = first ?? null;
      if (first) setCamera(new sdk.LocalVideoStream(first));
      else setCamOn(false);
    })()
      .catch((e) => {
        console.error(e);
        setDeviceError("Kamera und Mikrofon konnten nicht gestartet werden.");
        setCamOn(false);
      })
      .finally(() => setDevicesReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Beim Schließen des Tabs sauber auflegen
  useEffect(() => {
    if (!call) return;
    const hangUp = () => void call.hangUp().catch(() => {});
    window.addEventListener("pagehide", hangUp);
    return () => window.removeEventListener("pagehide", hangUp);
  }, [call]);

  function watch(next: Call) {
    const watchStream = (stream: RemoteVideoStream) => stream.on("isAvailableChanged", bump);
    const watchParticipant = (participant: RemoteParticipant) => {
      participant.videoStreams.forEach(watchStream);
      participant.on("videoStreamsUpdated", ({ added }) => {
        added.forEach(watchStream);
        bump();
      });
      participant.on("isSpeakingChanged", bump);
      participant.on("isMutedChanged", bump);
      participant.on("displayNameChanged", bump);
      participant.on("stateChanged", bump);
    };
    next.remoteParticipants.forEach(watchParticipant);
    next.on("remoteParticipantsUpdated", ({ added }) => {
      added.forEach(watchParticipant);
      bump();
    });
    next.on("isMutedChanged", bump);
    next.on("isLocalVideoStartedChanged", bump);
    next.on("isScreenSharingOnChanged", bump);
    let recordingAsked = false;
    next.on("stateChanged", () => {
      // Aufnahme starten, sobald der Anruf steht (der Server startet sie nur einmal)
      if (next.state === "Connected" && view?.recording && !recordingAsked) {
        recordingAsked = true;
        next.info
          .getServerCallId()
          .then((serverCallId) =>
            fetch(`/api/meet/${code}/aufnahme`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serverCallId }) })
          )
          .catch((e) => console.error(e));
      }
      if (next.state === "Disconnected") void finish(next.callEndReason?.code ? "Die Verbindung wurde getrennt." : null);
      bump();
    });
  }

  async function finish(reason: string | null) {
    if (leaving.current && reason) reason = null;
    leaving.current = false;
    agent.current?.dispose().catch(() => {});
    agent.current = null;
    setCall(null);
    setEnded(reason);
    setPhase("left");
    // Der Kamerastream endet mit dem Anruf; für die Vorschau einen neuen
    if (cameraInfo.current) setCamera(new (await loadSdk()).LocalVideoStream(cameraInfo.current));
  }

  async function join() {
    setJoinError(null);
    setPhase("joining");
    try {
      const response = await fetch(`/api/meet/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Beitreten hat nicht geklappt.");
      const sdk = await loadSdk();
      const { AzureCommunicationTokenCredential } = await import("@azure/communication-common");
      client.current ??= new sdk.CallClient();
      agent.current = await client.current.createCallAgent(new AzureCommunicationTokenCredential(data.token), { displayName: name.trim() });
      const next = agent.current.join(
        { groupId: data.group_id },
        {
          videoOptions: camOn && camera ? { localVideoStreams: [camera] } : undefined,
          audioOptions: { muted: !micOn },
        }
      );
      watch(next);
      setCall(next);
      setPhase("call");
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        // nur Komfort
      }
    } catch (e) {
      console.error(e);
      agent.current?.dispose().catch(() => {});
      agent.current = null;
      setJoinError(e instanceof Error ? e.message : "Beitreten hat nicht geklappt.");
      setPhase("lobby");
    }
  }

  async function leave() {
    if (!call) return;
    leaving.current = true;
    await call.hangUp().catch(() => {});
  }

  async function toggleMic() {
    if (!call) return setMicOn((on) => !on);
    await (call.isMuted ? call.unmute() : call.mute()).catch((e) => console.error(e));
  }

  async function toggleCamera() {
    if (!call) return setCamOn((on) => !on);
    try {
      const own = call.localVideoStreams.find((s) => s.mediaStreamType === "Video");
      if (own) return await call.stopVideo(own);
      if (!cameraInfo.current) return;
      await call.startVideo(new (await loadSdk()).LocalVideoStream(cameraInfo.current));
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleScreen() {
    if (!call) return;
    await (call.isScreenSharingOn ? call.stopScreenSharing() : call.startScreenSharing()).catch((e) => console.error(e));
  }

  const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  if (gone) {
    return (
      <MeetShell center>
        <CallDone title="Dieser Call ist vorbei." text="Danke fürs Gespräch! Den Link brauchst du nicht mehr." />
      </MeetShell>
    );
  }
  if (error) {
    return (
      <MeetShell center>
        <div className="max-w-md py-16 text-center">
          <p className="text-3xl font-semibold tracking-tight">{error}</p>
          <p className="mt-3 text-sm text-snow/60">Prüf den Link aus deiner Einladung oder schreib uns an hello@grid-agency.de.</p>
        </div>
      </MeetShell>
    );
  }
  if (!view) {
    return (
      <MeetShell center>
        <Spinner />
      </MeetShell>
    );
  }

  if (call && phase === "call") {
    const people = call.remoteParticipants.filter((p) => p.state !== "Disconnected");
    const screen = people
      .flatMap((p) => p.videoStreams.map((stream) => ({ p, stream })))
      .find(({ stream }) => stream.mediaStreamType === "ScreenSharing" && stream.isAvailable);
    const own = call.localVideoStreams.find((s) => s.mediaStreamType === "Video");
    const connecting = call.state !== "Connected";
    const waiting = people.length === 0 && !connecting;
    const hostFirst = view.host_name?.split(" ")[0]?.toLowerCase();
    const isHost = !!hostFirst && name.trim().toLowerCase().startsWith(hostFirst);
    const selfView = own ? (
      <StreamView key={own.source.id} stream={own} mirrored />
    ) : (
      <div className="absolute inset-0 grid place-items-center">
        <Avatar name={name || "Du"} className="h-10 w-10 text-sm" />
      </div>
    );
    return (
      // Eine Seite ohne Scrollen: fest auf den Bildschirm, nichts ragt raus
      <div className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-sky text-snow">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4">
          <MeetMark className="shrink-0 [&_img]:h-5 [&_span]:text-lg" />
          <p className="min-w-0 flex-1 truncate border-l border-snow/15 pl-3 text-sm font-medium">{view.title}</p>
          {view.recording && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error/12 px-2.5 py-1 text-[11px] font-medium tracking-wide text-error uppercase" title="Der Call wird aufgezeichnet und transkribiert">
              <span className="relative flex h-2 w-2">
                <span className="meet-ping absolute inset-0 rounded-full bg-error" />
                <span className="relative h-2 w-2 rounded-full bg-error" />
              </span>
              Aufnahme
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs text-snow/60">
            <Users className="h-3.5 w-3.5" /> {people.length + 1}
          </span>
        </header>

        <main className={clsx("relative min-h-0 flex-1 gap-3 overflow-hidden px-3 pb-3", screen ? "flex flex-col md:flex-row" : "grid grid-rows-[minmax(0,1fr)]")}>
          {screen && (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-ink">
              <StreamView key={`screen-${screen.stream.id}`} stream={screen.stream} fit />
              <span className="absolute bottom-2 left-2 rounded-full bg-sky/75 px-2.5 py-1 text-xs font-medium backdrop-blur">
                {screen.p.displayName || "Gast"} teilt den Bildschirm
              </span>
            </div>
          )}
          {waiting ? (
            <WaitingStage isHost={isHost} hostName={view.host_name} selfView={selfView} />
          ) : people.length === 0 ? (
            <div className="grid place-items-center rounded-3xl border border-snow/10 bg-surface/60 p-6 text-center">
              <div>
                <Spinner />
                <p className="mt-4 text-base font-medium">Wird verbunden …</p>
              </div>
            </div>
          ) : (
            <div
              className={clsx(
                "grid min-h-0 gap-3",
                screen ? "h-32 shrink-0 auto-cols-[12rem] grid-flow-col md:h-auto md:w-64 md:auto-rows-[9rem] md:grid-flow-row" : "h-full",
                !screen && people.length === 2 && "md:grid-cols-2",
                !screen && people.length >= 3 && "grid-cols-2",
                !screen && people.length >= 5 && "md:grid-cols-3"
              )}
            >
              {people.map((p, i) => (
                <Tile key={p.identifier ? JSON.stringify(p.identifier) : i} participant={p} />
              ))}
            </div>
          )}

          {/* Eigenes Bild klein in der Ecke (beim Warten steckt es in der Bühne) */}
          {!waiting && (
            <div className="absolute right-6 bottom-6 aspect-video w-32 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-snow/15 md:w-48">
              {selfView}
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-sky/75 px-2 py-0.5 text-[11px] backdrop-blur">
                {call.isMuted && <MicOff className="h-3 w-3" aria-label="stumm" />} Du
              </span>
            </div>
          )}
        </main>

        <footer className="flex shrink-0 items-center justify-center gap-3 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ControlButton label={call.isMuted ? "Mikrofon an" : "Stummschalten"} active={!call.isMuted} onClick={toggleMic}>
            {call.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </ControlButton>
          <ControlButton label={own ? "Kamera aus" : "Kamera an"} active={!!own} onClick={toggleCamera}>
            {own ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlButton>
          {canShare && (
            <ControlButton label={call.isScreenSharingOn ? "Teilen beenden" : "Bildschirm teilen"} active={!call.isScreenSharingOn} onClick={toggleScreen}>
              <MonitorUp className="h-5 w-5" />
            </ControlButton>
          )}
          <ControlButton label="Auflegen" danger onClick={leave}>
            <PhoneOff className="h-5 w-5" />
          </ControlButton>
        </footer>
      </div>
    );
  }

  if (phase === "left" && !ended) {
    return (
      <MeetShell center>
        <CallDone title="Call beendet." text="Danke fürs Gespräch! Du kannst das Fenster jetzt schließen.">
          <Button variant="secondary" onClick={() => setPhase("lobby")}>
            Wieder beitreten
          </Button>
        </CallDone>
      </MeetShell>
    );
  }

  const start = new Date(view.starts_at);
  const joining = phase === "joining";
  return (
    <MeetShell>
      <div className="grid gap-8 py-6 md:grid-cols-[1.4fr_1fr] md:items-center md:py-14">
        <div className="relative aspect-video overflow-hidden rounded-3xl bg-surface ring-1 ring-snow/10">
          {camOn && camera && phase !== "left" ? (
            <StreamView key={camera.source.id} stream={camera} mirrored />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-snow/60">
              {!devicesReady ? <Spinner /> : phase === "left" ? null : <span className="inline-flex items-center gap-2"><VideoOff className="h-4 w-4" /> Kamera aus</span>}
            </div>
          )}
          {phase !== "left" && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-3">
              <ControlButton label={micOn ? "Stummschalten" : "Mikrofon an"} active={micOn} onClick={toggleMic}>
                {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </ControlButton>
              <ControlButton label={camOn ? "Kamera aus" : "Kamera an"} active={camOn} onClick={() => (camera ? toggleCamera() : undefined)}>
                {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </ControlButton>
            </div>
          )}
          {phase === "left" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="text-lg font-medium">{ended ?? "Du hast den Call verlassen."}</p>
                <p className="mt-1 text-sm text-snow/60">Danke fürs Gespräch!</p>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium tracking-[0.25em] text-snow/55 uppercase">Video-Call</p>
          <h1 className="mt-3 text-2xl leading-tight font-semibold tracking-tight md:text-3xl">{view.title}</h1>
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-snow/65">
            <CalendarClock className="h-4 w-4" />
            {day.format(start)} · {time.format(start)}–{time.format(new Date(view.ends_at))} Uhr
          </p>
          <form
            className="mt-6 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void join();
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Dein Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required placeholder="Vor- und Nachname" />
            </label>
            {deviceError && <p className="rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{deviceError}</p>}
            {joinError && <p className="rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{joinError}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={joining} loadingText="Wird verbunden …" disabled={!name.trim() || !devicesReady}>
              {phase === "left" ? "Wieder beitreten" : "Jetzt beitreten"}
            </Button>
            {view.recording && (
              <p className="text-xs leading-relaxed text-snow/55">
                Mit Klick auf „Jetzt beitreten“ stimmst du zu, dass der Call aufgezeichnet (nur Ton) und transkribiert wird. Daraus erstellen wir eine
                Zusammenfassung und die nächsten Aufgaben. Die Tonaufnahme löschen wir direkt nach dem Transkribieren. Mehr in der{" "}
                <a href="https://grid-agency.de/datenschutz#video-call" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-snow">
                  Datenschutzerklärung
                </a>
                .
              </p>
            )}
          </form>
        </div>
      </div>
    </MeetShell>
  );
}
