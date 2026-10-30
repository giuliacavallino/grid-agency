"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, MessageCircle, RefreshCw, Search, Send, ShieldCheck, Users } from "lucide-react";
import { ConsentRequiredError, requestConsent, useAuth } from "@/lib/auth";
import { cn as clsx } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { chatTitle, chatWith, listChats, listMessages, sendMessage, TEAMS_SCOPES, type Chat, type ChatMessage } from "@/lib/teams";
import { Avatar, Button, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "./ui";
import { useTeam } from "./access";
import { PersonAvatar } from "./person";

// Teams-Chats im Intranet: Liste der eigenen Chats, Verlauf, Antworten und
// neue 1:1-Chats mit dem Team. Öffnen von überall über useTeamsChat().

type OpenOptions = { email?: string; text?: string };
type TeamsApi = { open: (options?: OpenOptions) => void };

const TeamsContext = createContext<TeamsApi>({ open: () => {} });
export const useTeamsChat = () => useContext(TeamsContext);

export function TeamsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; request: OpenOptions | null; key: number }>({ open: false, request: null, key: 0 });
  const open = useCallback((options?: OpenOptions) => setState((s) => ({ open: true, request: options ?? null, key: s.key + 1 })), []);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <TeamsContext.Provider value={api}>
      {children}
      <Sheet open={state.open} onClose={() => setState((s) => ({ ...s, open: false }))} title="Teams" subtitle="Chats aus Microsoft Teams" width="max-w-lg">
        <TeamsPanel key={state.key} request={state.request} />
      </Sheet>
    </TeamsContext.Provider>
  );
}

/** Knopf zum Öffnen, z. B. in der Navbar oder Seitenleiste */
export function TeamsButton({ className, label = false }: { className?: string; label?: boolean }) {
  const { open } = useTeamsChat();
  if (label) {
    return (
      <button type="button" onClick={() => open()} className={className}>
        <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
        <span>Teams</span>
      </button>
    );
  }
  return (
    <IconButton label="Teams-Chats" className={className} onClick={() => open()}>
      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
    </IconButton>
  );
}

function TeamsPanel({ request }: { request: OpenOptions | null }) {
  const auth = useAuth();
  const toast = useToast();
  const me = auth.status === "signed-in" ? auth.account : null;
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState(request?.text ?? "");
  const [opening, setOpening] = useState(!!request?.email);

  const load = useCallback(async () => {
    try {
      setChats(await listChats());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Chats beim Öffnen und dann alle 30 s laden
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const openWith = useCallback(
    async (email: string) => {
      if (!me) return;
      setOpening(true);
      try {
        const id = await chatWith(me.email, email);
        setChatId(id);
        load();
      } catch (e) {
        if (e instanceof ConsentRequiredError) setError(e);
        else toast(e instanceof Error ? e.message : "Chat konnte nicht geöffnet werden", "error");
      }
      setOpening(false);
    },
    [me, load, toast]
  );

  // Aus einer Aufgabe heraus: direkt den Chat mit der Person öffnen
  const requested = useRef(false);
  useEffect(() => {
    if (request?.email && !requested.current) {
      requested.current = true;
      openWith(request.email);
    }
  }, [request, openWith]);

  if (error instanceof ConsentRequiredError) return <Connect />;
  if (error && !chats) return <Problem error={error} onRetry={load} />;
  if (opening || !chats) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }

  const chat = chats.find((c) => c.id === chatId);
  if (chatId) {
    return (
      <Conversation
        key={chatId}
        chatId={chatId}
        title={chat && me ? chatTitle(chat, me.email) : "Chat"}
        webUrl={chat?.webUrl ?? null}
        myName={me?.name ?? ""}
        draft={draft}
        onDraft={setDraft}
        onBack={() => {
          setChatId(null);
          setDraft("");
          load();
        }}
      />
    );
  }
  return <ChatList chats={chats} myEmail={me?.email ?? ""} onOpen={setChatId} onNew={openWith} />;
}

function Connect() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-sm text-snow/65">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-snow/10 text-snow">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <p className="text-lg font-medium text-snow">Teams verbinden</p>
        <p>Damit du hier deine Chats siehst und Nachrichten schickst, braucht es einmal deine Zustimmung bei Microsoft. Nachrichten gehen dann ganz normal von deinem Teams-Konto aus.</p>
        <Button
          variant="primary"
          className="mt-2"
          loading={busy}
          loadingText="Weiterleitung zu Microsoft …"
          onClick={() => {
            setBusy(true);
            requestConsent(TEAMS_SCOPES).catch(() => setBusy(false));
          }}
        >
          Mit Teams verbinden
        </Button>
      </div>
    </div>
  );
}

function Problem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-sm text-snow/65">
        <p className="text-lg font-medium text-snow">Teams lädt gerade nicht</p>
        <p>{error instanceof Error ? error.message : "Unbekannter Fehler"}</p>
        <Button icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Erneut versuchen
        </Button>
      </div>
    </div>
  );
}

function ChatList({ chats, myEmail, onOpen, onNew }: { chats: Chat[]; myEmail: string; onOpen: (id: string) => void; onNew: (email: string) => void }) {
  const team = useTeam().filter((m) => m.email !== myEmail.toLowerCase());
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = chats.filter((c) => !q || chatTitle(c, myEmail).toLowerCase().includes(q) || c.lastMessage?.text.toLowerCase().includes(q));

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-snow/[0.08] p-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chats durchsuchen" aria-label="Chats durchsuchen" className="h-9 pl-9" />
        </div>
        {team.length > 0 && (
          <Select
            value=""
            onChange={(e) => e.target.value && onNew(e.target.value)}
            aria-label="Neuer Chat mit"
            className="h-9 w-auto max-w-44"
          >
            <option value="">+ Neuer Chat</option>
            {team.map((m) => (
              <option key={m.email} value={m.email}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((chat) => {
          const title = chatTitle(chat, myEmail);
          const other = chat.chatType === "oneOnOne" ? chat.members.find((m) => m.email !== myEmail.toLowerCase()) : null;
          return (
            <li key={chat.id}>
              <button type="button" onClick={() => onOpen(chat.id)} className="flex w-full items-center gap-3 border-b border-snow/[0.06] px-4 py-3 text-left hover:bg-snow/[0.04]">
                {other ? (
                  <PersonAvatar name={other.displayName ?? title} email={other.email ?? undefined} className="h-10 w-10" />
                ) : chat.chatType === "oneOnOne" ? (
                  <Avatar name={title} className="h-10 w-10" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-snow/10 text-snow/70">
                    <Users className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-[14px] font-medium">{title}</span>
                    {chat.lastMessage && <span className="ml-auto shrink-0 text-[12px] text-snow/50">{relativeTime(chat.lastMessage.at)}</span>}
                  </span>
                  <span className="block truncate text-[13px] text-snow/60">
                    {chat.lastMessage ? `${chat.lastMessage.from ? `${chat.lastMessage.from.split(" ")[0]}: ` : ""}${chat.lastMessage.text}` : "Noch keine Nachrichten"}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="p-8 text-center text-sm text-snow/55">Keine Chats gefunden</li>}
      </ul>
    </div>
  );
}

function Conversation({
  chatId,
  title,
  webUrl,
  myName,
  draft,
  onDraft,
  onBack,
}: {
  chatId: string;
  title: string;
  webUrl: string | null;
  myName: string;
  draft: string;
  onDraft: (text: string) => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await listMessages(chatId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nachrichten konnten nicht geladen werden", "error");
      setMessages((m) => m ?? []);
    }
  }, [chatId, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Verlauf laden und alle 10 s auffrischen
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    // scrollIntoView gibt in neueren Browsern ein Promise zurück, das darf der Effekt nicht liefern
    void bottom.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(chatId, text);
      onDraft("");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Senden fehlgeschlagen", "error");
    }
    setSending(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-snow/[0.08] px-2 py-2">
        <IconButton label="Zurück zu allen Chats" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </IconButton>
        <p className="min-w-0 flex-1 truncate text-[15px] font-medium">{title}</p>
        {webUrl && (
          <a href={webUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] text-snow/60 hover:bg-snow/[0.06] hover:text-snow">
            In Teams <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!messages ? (
          <div className="grid h-full place-items-center">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-sm text-snow/55">Noch keine Nachrichten. Schreib die erste.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((m, i) => {
              const mine = m.from === myName;
              const showName = !mine && messages[i - 1]?.from !== m.from;
              return (
                <li key={m.id} className={clsx("flex flex-col", mine ? "items-end" : "items-start")}>
                  {showName && <span className="mb-0.5 px-1 text-[11.5px] text-snow/55">{m.from}</span>}
                  <div
                    className={clsx(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug whitespace-pre-wrap break-words",
                      mine ? "rounded-br-md bg-[#5b5fc7] text-white" : "rounded-bl-md bg-snow/[0.07]"
                    )}
                    title={new Date(m.createdDateTime).toLocaleString("de-DE")}
                  >
                    {m.text}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-snow/[0.08] p-3"
      >
        <Textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          autoFocus
          rows={Math.min(6, Math.max(1, draft.split("\n").length))}
          placeholder="Nachricht schreiben (Enter sendet, Umschalt+Enter neue Zeile)"
          aria-label="Nachricht"
          className="min-h-10 flex-1 resize-none py-2"
        />
        <Button type="submit" variant="primary" className="h-10 w-10 px-0" aria-label="Senden" loading={sending} disabled={!draft.trim()}>
          {!sending && <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

/** „Per Teams schicken“ für ein To-do: öffnet den Chat mit der zuständigen
 * Person, die Nachricht steht schon drin und wird erst beim Senden verschickt. */
export function SendViaTeams({ email, text, className }: { email: string; text: string; className?: string }) {
  const { open } = useTeamsChat();
  return (
    <Button size="sm" variant="ghost" className={className} icon={<MessageCircle className="h-4 w-4" />} onClick={() => open({ email, text })}>
      Per Teams schicken
    </Button>
  );
}

