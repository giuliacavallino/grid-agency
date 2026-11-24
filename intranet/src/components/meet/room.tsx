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
import { CalendarClock, Check, Copy, MessageSquare, Mic, MicOff, MonitorUp, PhoneOff, Repeat, SendHorizontal, Users, Video, VideoOff, X } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { Avatar, Button, Input, Spinner } from "@/components/ui";
import { MeetMark, MeetShell } from "./brand";
import { CallDone } from "./done";
import { WaitingStage } from "./waiting";

// Video-Call unter meet.grid-agency.de/<code> mit Azure Communication
// Services: Vorschau mit Kamera und Mikro, Name eintragen, beitreten. Das
// SDK läuft nur im Browser und wird erst hier nachgeladen.

/** recording: Calls werden aufgezeichnet und transkribiert (Hinweis unter „Jetzt beitreten“) */
/** series: Jour fixe, z. B. „Jeden Dienstag, 10:00“; starts_at ist dann der nächste Termin */
type View = { title: string; starts_at: string; ends_at: string; host_name: string | null; recording?: boolean; series?: string | null };
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

/** Dauer des Calls (ab dem eigenen Beitritt), läuft jede Sekunde mit */
function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  const text = h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  return (
    <span className="text-xs font-medium text-snow/70 tabular-nums" title="Dauer des Calls" aria-label={`Dauer ${text}`}>
      {text}
    </span>
  );
}

function ControlButton({ label, active = true, danger, badge, onClick, children }: { label: string; active?: boolean; danger?: boolean; badge?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={danger ? undefined : !active}
      title={label}
      className={clsx(
        "grid h-12 w-12 place-items-center rounded-full transition-[transform,background-color] duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow",
        "relative",
        danger ? "bg-error text-sky hover:bg-error/85" : active ? "border border-snow/15 bg-snow/[0.08] text-snow hover:bg-snow/[0.16]" : "bg-snow text-sky hover:bg-snow/85"
      )}
    >
      {children}
      {!!badge && (
        <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-error px-1 text-[11px] font-semibold text-white">{badge > 9 ? "9+" : badge}</span>
      )}
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

/** Gastgeber*in allein im Call: eigenes Bild groß, Hinweis und Link zum Teilen */
function EmptyRoom({ selfView }: { selfView: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href.split("?")[0]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage gesperrt: Link steht ohnehin in der Adresszeile
    }
  }
  return (
    <div className="relative min-h-0 overflow-hidden rounded-3xl bg-ink">
      {selfView}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-gradient-to-t from-sky/90 via-sky/60 to-transparent px-6 pt-20 pb-6 text-center">
        <p className="text-lg font-semibold">Du bist im Call. Noch ist niemand da.</p>
        <p className="max-w-md text-sm text-snow/70">Gäste warten im Wartebereich und kommen automatisch dazu, sobald du da bist.</p>
        <Button size="sm" variant="secondary" className="mt-2" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={copy}>
          {copied ? "Link kopiert" : "Einladungslink kopieren"}
        </Button>
      </div>
    </div>
  );
}

type ChatMessage = { id: string; created_at: string; name: string; text: string };

/** Links in Chatnachrichten anklickbar machen */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Chat im Call: Nachrichten des laufenden Termins, Eingabe unten */
function ChatPanel({ messages, me, onSend, onClose }: { messages: ChatMessage[]; me: string; onSend: (text: string) => Promise<boolean>; onClose: () => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);
  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    if (await onSend(text)) setText("");
    setSending(false);
  }
  return (
    <aside className="absolute inset-0 z-20 flex flex-col bg-sky md:static md:z-auto md:w-80 md:shrink-0 md:rounded-2xl md:border md:border-snow/10 md:bg-surface">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-snow/10 px-4">
        <p className="text-sm font-semibold">Chat</p>
        <button type="button" onClick={onClose} aria-label="Chat schließen" className="grid h-8 w-8 place-items-center rounded-full text-snow/60 hover:bg-snow/[0.08] hover:text-snow">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {!messages.length && <p className="pt-6 text-center text-sm text-snow/50">Noch keine Nachrichten. Links, Notizen oder Fragen hier teilen.</p>}
        {messages.map((m) => {
          const mine = m.name === me;
          return (
            <div key={m.id} className={clsx("flex flex-col", mine && "items-end")}>
              <p className="mb-0.5 text-[11px] text-snow/50">
                {mine ? "Du" : m.name} · {time.format(new Date(m.created_at))}
              </p>
              <p className={clsx("max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words", mine ? "bg-snow text-sky" : "bg-snow/[0.08]")}>
                <Linkified text={m.text} />
              </p>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex shrink-0 items-end gap-2 border-t border-snow/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Nachricht schreiben …"
          aria-label="Nachricht"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-snow/15 bg-snow/[0.06] px-3 py-2 text-sm outline-none focus:border-snow/40"
        />
        <Button type="submit" variant="primary" className="h-10 w-10 shrink-0 px-0" aria-label="Senden" loading={sending} disabled={!text.trim()}>
          {sending ? null : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </form>
    </aside>
  );
}

/** Verständliche Hilfe, wenn das Teilen des Bildschirms scheitert */
function shareError(error: unknown) {
  const name = (error as { name?: string })?.name ?? "";
  const message = String((error as { message?: string })?.message ?? "");
  const mac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || navigator.userAgent);
  if (name === "NotAllowedError" || /permission|denied|not allowed/i.test(message)) {
    return mac
      ? "Bildschirm teilen wurde blockiert. Am Mac: Systemeinstellungen → Datenschutz & Sicherheit → Bildschirm- & Systemaudioaufnahme → deinen Browser erlauben, Browser neu starten und erneut versuchen."
      : "Bildschirm teilen wurde abgebrochen oder blockiert. Bitte erneut auf „Bildschirm teilen“ klicken und im Fenster einen Bildschirm, ein Fenster oder einen Tab auswählen.";
  }
  if (name === "NotFoundError" || name === "NotReadableError") return "Der Bildschirm konnte nicht aufgenommen werden. Bitte ein anderes Fenster oder den ganzen Bildschirm wählen.";
  return "Bildschirm teilen hat nicht geklappt. Bitte Chrome, Edge, Firefox oder Safari in der aktuellen Version am Computer verwenden.";
}

export function MeetRoom({ code }: { code: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
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

  // Chat: alle paar Sekunden neue Nachrichten holen, solange man im Call ist
  const inCall = !!call;
  useEffect(() => {
    if (!inCall) return;
    let stop = false;
    let last: string | null = null;
    async function poll() {
      try {
        const response = await fetch(`/api/meet/${code}/chat${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
        if (response.ok) {
          const fresh = (await response.json()) as ChatMessage[];
          if (fresh.length && !stop) {
            last = fresh[fresh.length - 1].created_at;
            setMessages((old) => {
              const known = new Set(old.map((m) => m.id));
              return [...old, ...fresh.filter((m) => !known.has(m.id))];
            });
          }
        }
      } catch {
        // nächster Versuch beim nächsten Takt
      }
      if (!stop) timer = window.setTimeout(poll, 3000);
    }
    let timer = window.setTimeout(poll, 0);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [inCall, code]);

  // Hinweise (z. B. Bildschirm teilen) nach einer Weile ausblenden
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 12000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function sendMessage(text: string) {
    try {
      const response = await fetch(`/api/meet/${code}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Nachricht nicht gesendet");
      setMessages((old) => (old.some((m) => m.id === data.id) ? old : [...old, data as ChatMessage]));
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Nachricht nicht gesendet");
      return false;
    }
  }

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
      if (next.state === "Connected") setConnectedAt((at) => at ?? Date.now());
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
    setConnectedAt(null);
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

  const canShare = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  async function toggleScreen() {
    if (!call) return;
    if (!canShare) {
      setNotice("Bildschirm teilen geht nur am Computer im Browser (Chrome, Edge, Firefox oder Safari), nicht am Handy oder Tablet.");
      return;
    }
    try {
      if (call.isScreenSharingOn) await call.stopScreenSharing();
      else {
        setNotice(null);
        await call.startScreenSharing();
      }
    } catch (e) {
      console.error(e);
      setNotice(shareError(e));
    }
    bump();
  }

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
    const hostFirst = view.host_name?.split(" ")[0]?.toLowerCase();
    const isHost = !!hostFirst && name.trim().toLowerCase().startsWith(hostFirst);
    // Wartebereich nur für Gäste; wer den Call organisiert, ist direkt im Call
    const alone = people.length === 0 && !connecting;
    const waiting = alone && !isHost;
    const unread = chatOpen ? 0 : messages.filter((m) => m.name !== name.trim()).length - seen;
    const openChat = () => {
      setChatOpen((open) => !open);
      setSeen(messages.filter((m) => m.name !== name.trim()).length);
    };
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
          <MeetMark size="sm" />
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
          {connectedAt && !connecting && <CallTimer since={connectedAt} />}
          <span className="inline-flex items-center gap-1.5 text-xs text-snow/60">
            <Users className="h-3.5 w-3.5" /> {people.length + 1}
          </span>
        </header>

        {(notice || call.isScreenSharingOn) && (
          <div className="mx-3 mb-2 flex items-start gap-3 rounded-2xl border border-snow/10 bg-surface px-4 py-2.5 text-sm" role="status">
            <MonitorUp className="mt-0.5 h-4 w-4 shrink-0 text-snow/60" />
            <p className="min-w-0 flex-1">{notice ?? "Du teilst deinen Bildschirm. Alle im Call sehen ihn."}</p>
            {call.isScreenSharingOn && !notice ? (
              <button type="button" onClick={toggleScreen} className="shrink-0 rounded-full bg-error px-3 py-1 text-xs font-semibold text-sky">
                Teilen beenden
              </button>
            ) : (
              <button type="button" onClick={() => setNotice(null)} aria-label="Hinweis schließen" className="shrink-0 text-snow/50 hover:text-snow">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="relative flex min-h-0 flex-1 gap-3 pr-3 md:pr-3">
        <main className={clsx("relative min-h-0 flex-1 gap-3 overflow-hidden pb-3 pl-3", screen ? "flex flex-col md:flex-row" : "grid grid-rows-[minmax(0,1fr)]")}>
          {screen && (
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-ink">
              <StreamView key={`screen-${screen.stream.id}`} stream={screen.stream} fit />
              <span className="absolute bottom-2 left-2 rounded-full bg-sky/75 px-2.5 py-1 text-xs font-medium backdrop-blur">
                {screen.p.displayName || "Gast"} teilt den Bildschirm
              </span>
            </div>
          )}
          {waiting ? (
            <WaitingStage hostName={view.host_name} selfView={selfView} series={view.series} />
          ) : alone ? (
            <EmptyRoom selfView={selfView} />
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

          {/* Eigenes Bild klein in der Ecke (beim Warten und allein steckt es in der Bühne) */}
          {!alone && (
            <div className="absolute right-6 bottom-6 aspect-video w-32 overflow-hidden rounded-xl bg-surface shadow-lg ring-1 ring-snow/15 md:w-48">
              {selfView}
              <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-sky/75 px-2 py-0.5 text-[11px] backdrop-blur">
                {call.isMuted && <MicOff className="h-3 w-3" aria-label="stumm" />} Du
              </span>
            </div>
          )}
        </main>
        {chatOpen && (
          <div className="absolute inset-0 z-20 pb-3 md:static md:flex md:pb-3">
            <ChatPanel messages={messages} me={name.trim()} onSend={sendMessage} onClose={openChat} />
          </div>
        )}
        </div>

        <footer className="flex shrink-0 items-center justify-center gap-3 pt-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ControlButton label={call.isMuted ? "Mikrofon an" : "Stummschalten"} active={!call.isMuted} onClick={toggleMic}>
            {call.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </ControlButton>
          <ControlButton label={own ? "Kamera aus" : "Kamera an"} active={!!own} onClick={toggleCamera}>
            {own ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlButton>
          <ControlButton label={call.isScreenSharingOn ? "Teilen beenden" : "Bildschirm teilen"} active={!call.isScreenSharingOn} onClick={toggleScreen}>
            <MonitorUp className="h-5 w-5" />
          </ControlButton>
          <ControlButton label={chatOpen ? "Chat schließen" : "Chat öffnen"} active={!chatOpen} badge={unread > 0 ? unread : undefined} onClick={openChat}>
            <MessageSquare className="h-5 w-5" />
          </ControlButton>
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
      <div className="grid gap-5 py-4 md:grid-cols-[1.4fr_1fr] md:items-center md:gap-8 md:py-6">
        <div className="relative mx-auto aspect-video w-full max-w-[calc(42dvh*16/9)] overflow-hidden rounded-3xl bg-surface ring-1 ring-snow/10">
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
          {view.series && (
            <p className="mt-3 flex items-center gap-2 text-sm font-medium text-snow/80">
              <Repeat className="h-4 w-4" />
              {view.series}
            </p>
          )}
          <p className={clsx("inline-flex items-center gap-2 text-sm text-snow/65", view.series ? "mt-1.5" : "mt-3")}>
            <CalendarClock className="h-4 w-4" />
            {view.series && "Nächster Termin: "}
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
