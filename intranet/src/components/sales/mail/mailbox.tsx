"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  Ban,
  ChevronDown,
  FileText,
  Flag,
  Inbox,
  Mail,
  MailOpen,
  PanelLeft,
  Search,
  Send,
  SquarePen,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ConsentRequiredError } from "@/lib/auth";
import { MAIL_SCOPES, mailboxLabel } from "@/lib/config";
import { useResource } from "@/lib/data";
import { FOLDERS, graphFor, graphErrorMessage, useAsync, type FolderKey, type MailFolder, type Message } from "@/lib/graph";
import type { InboundMessage } from "@/lib/sales/types";
import { accentText } from "@/lib/theme";
import { Button, Dialog, Empty, IconButton, Input, Select, Spinner, useToast } from "@/components/ui";
import { GraphProblem } from "./access";
import { Compose, type ComposeState } from "./compose";
import { MAIL_ACCENT, MessageList } from "./message-list";
import { ReadingPane } from "./reading-pane";

const FOLDER_ICON: Record<FolderKey, LucideIcon> = {
  inbox: Inbox,
  drafts: FileText,
  sentitems: Send,
  archive: Archive,
  deleteditems: Trash2,
  junkemail: Ban,
};

const OUTGOING: FolderKey[] = ["sentitems", "drafts"];

type MailboxFolders = { mailbox: string; folders?: MailFolder[]; error?: unknown };

/** Posteingang im Aufbau von Outlook im Web: Ordnerleiste mit allen
 * Postfächern des Bereichs, Liste, Lesebereich. Auf dem Handy nacheinander
 * statt nebeneinander. */
export function Mailbox({ mailboxes }: { mailboxes: string[] }) {
  const params = useSearchParams();
  const toast = useToast();
  const [mailbox, setMailbox] = useState(mailboxes[0]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [folder, setFolder] = useState<FolderKey>("inbox");
  const [tab, setTab] = useState<"focused" | "other">("focused");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState | null>(() => {
    const to = params.get("to");
    return to ? { mode: "new", to } : null;
  });
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [busy, setBusy] = useState<"delete" | "archive" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const graph = graphFor(mailbox);
  // Ordner aller Postfächer; ein Postfach ohne Zugriff zeigt nur einen Hinweis
  const folders = useAsync<MailboxFolders[]>(`folders:${mailboxes.join()}`, () =>
    Promise.all(
      mailboxes.map((address) =>
        graphFor(address)
          .folders()
          .then(
            (list) => ({ mailbox: address, folders: list }),
            (error) => ({ mailbox: address, error })
          )
      )
    )
  );
  const useTabs = folder === "inbox" && !query;
  const listKey = `${mailbox}|${folder}|${useTabs ? tab : ""}|${query}`;
  const list = useAsync(listKey, () =>
    graph.messages({ folder, focused: useTabs ? tab === "focused" : null, search: query || undefined })
  );
  const messages = useMemo(() => list.data?.items ?? [], [list.data]);
  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const outgoing = OUTGOING.includes(folder);

  // Einordnung durch den Mail-Abgleich (Anfrage → Lead / Bewerbung). Nur für
  // die ersten 40 Mails, damit die URL beim Weiterblättern kurz bleibt.
  const ids = messages.map((m) => m.internetMessageId).filter(Boolean).slice(0, 40);
  const { data: inboundRows } = useResource<InboundMessage[]>(
    ids.length ? `/api/sales/inbound_messages?ids=${encodeURIComponent(ids.join(","))}` : null
  );
  const inbound = useMemo(() => new Map((inboundRows ?? []).map((row) => [row.id, row])), [inboundRows]);

  // Fehlende Zustimmung gilt für alle Postfächer: dann die große Abfrage zeigen
  const consent = folders.data?.find((f) => f.error instanceof ConsentRequiredError)?.error;
  const current = folders.data?.find((f) => f.mailbox === mailbox);
  const problem = consent ?? folders.error ?? current?.error ?? list.error;

  function patchMessage(id: string, patch: Partial<Message>) {
    list.setData((page) => ({ ...page, items: page.items.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }

  function changeUnread(delta: number) {
    folders.setData((all) =>
      all.map((box) =>
        box.mailbox !== mailbox || !box.folders
          ? box
          : {
              ...box,
              folders: box.folders.map((f) =>
                f.key === folder ? { ...f, unreadItemCount: Math.max(0, f.unreadItemCount + delta) } : f
              ),
            }
      )
    );
  }

  function select(message: Message) {
    setCompose(null);
    setSelectedId(message.id);
    if (!message.isRead && !outgoing) {
      patchMessage(message.id, { isRead: true });
      changeUnread(-1);
      graph.update(message.id, { isRead: true }).catch(() => {
        patchMessage(message.id, { isRead: false });
        changeUnread(1);
      });
    }
  }

  function openFolder(key: FolderKey, address = mailbox) {
    setMailbox(address);
    setFolder(key);
    setSelectedId(null);
    setCompose(null);
    setQuery("");
    setSearchInput("");
  }

  async function toggleRead() {
    if (!selected) return;
    const isRead = !selected.isRead;
    patchMessage(selected.id, { isRead });
    changeUnread(isRead ? -1 : 1);
    try {
      await graph.update(selected.id, { isRead });
    } catch {
      toast("Ändern fehlgeschlagen", "error");
      list.reload();
    }
  }

  async function toggleFlag() {
    if (!selected) return;
    const flag = { flagStatus: selected.flag.flagStatus === "flagged" ? "notFlagged" : "flagged" } as const;
    patchMessage(selected.id, { flag });
    try {
      await graph.update(selected.id, { flag });
    } catch {
      toast("Kennzeichnen fehlgeschlagen", "error");
      list.reload();
    }
  }

  /** Verschieben oder endgültig löschen; danach die nächste Nachricht wählen. */
  async function removeSelected(kind: "delete" | "archive") {
    if (!selected) return;
    const index = messages.findIndex((m) => m.id === selected.id);
    const nextMessage = messages[index + 1] ?? messages[index - 1] ?? null;
    setBusy(kind);
    try {
      if (kind === "archive") await graph.move(selected.id, "archive");
      else if (folder === "deleteditems") await graph.remove(selected.id);
      else await graph.move(selected.id, "deleteditems");
      list.setData((page) => ({ ...page, items: page.items.filter((m) => m.id !== selected.id) }));
      setSelectedId(nextMessage?.id ?? null);
      folders.reload();
      toast(kind === "archive" ? "Archiviert" : folder === "deleteditems" ? "Endgültig gelöscht" : "Gelöscht");
    } catch {
      toast("Das hat nicht geklappt", "error");
    }
    setBusy(null);
    setConfirmDelete(false);
  }

  async function loadMore() {
    const next = list.data?.next;
    if (!next) return;
    setLoadingMore(true);
    try {
      const more = await graph.messages({ folder, next });
      list.setData((page) => ({ items: [...page.items, ...more.items], next: more.next }));
    } catch {
      toast("Weitere Nachrichten konnten nicht geladen werden", "error");
    }
    setLoadingMore(false);
  }

  const folderLabel = FOLDERS.find((f) => f.key === folder)?.label ?? "";
  const multiple = mailboxes.length > 1;
  const showDetail = !!(compose || selected);

  return (
    <div className="flex h-full flex-col bg-canvas">
      {/* Befehlsleiste */}
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-snow/[0.08] bg-sky px-2 md:px-3">
        <IconButton label="Ordner ein-/ausblenden" onClick={() => setFoldersOpen((o) => !o)} className="hidden md:inline-flex">
          <PanelLeft className="h-4 w-4" />
        </IconButton>
        <Button
          variant="primary"
          size="sm"
          icon={<SquarePen className="h-4 w-4" />}
          onClick={() => {
            setCompose({ mode: "new" });
            setSelectedId(null);
          }}
          className="mr-1"
        >
          <span className="hidden sm:inline">Neue E-Mail</span>
        </Button>
        <div className={cn("flex items-center gap-0.5", !selected && "pointer-events-none opacity-40", !selected && "max-md:hidden")}>
          <Command
            icon={Trash2}
            label="Löschen"
            loading={busy === "delete"}
            onClick={() => (folder === "deleteditems" ? setConfirmDelete(true) : removeSelected("delete"))}
          />
          {folder !== "archive" && (
            <Command icon={Archive} label="Archivieren" loading={busy === "archive"} onClick={() => removeSelected("archive")} />
          )}
          <Command
            icon={selected?.isRead ? Mail : MailOpen}
            label={selected?.isRead ? "Als ungelesen markieren" : "Als gelesen markieren"}
            short={selected?.isRead ? "Ungelesen" : "Gelesen"}
            onClick={toggleRead}
          />
          <Command
            icon={Flag}
            label={selected?.flag.flagStatus === "flagged" ? "Kennzeichnung entfernen" : "Kennzeichnen"}
            short="Kennzeichnen"
            onClick={toggleFlag}
          />
        </div>
        <form
          className="relative ml-auto hidden w-full max-w-72 sm:block"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(searchInput.trim());
            setSelectedId(null);
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`In „${folderLabel}“ suchen`}
            aria-label="E-Mails durchsuchen"
            className="h-8 rounded-full pr-8 pl-9 text-[13px]"
          />
          {query && (
            <button
              type="button"
              aria-label="Suche zurücksetzen"
              onClick={() => {
                setQuery("");
                setSearchInput("");
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-snow/50 hover:text-snow"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      {problem ? (
        <GraphProblem
          error={problem}
          scopes={MAIL_SCOPES}
          onRetry={() => {
            folders.reload();
            list.reload();
          }}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* Ordner */}
          {foldersOpen && (
            <nav aria-label="Ordner" className="hidden w-60 shrink-0 overflow-y-auto border-r border-snow/[0.08] bg-sky px-2 py-3 md:block">
              {mailboxes.map((address) => {
                const box = folders.data?.find((f) => f.mailbox === address);
                const closed = collapsed.has(address);
                return (
                  <div key={address} className="mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((set) => {
                          const next = new Set(set);
                          if (closed) next.delete(address);
                          else next.add(address);
                          return next;
                        })
                      }
                      aria-expanded={!closed}
                      className="mb-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium tracking-wide text-snow/55 uppercase hover:text-snow"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", closed && "-rotate-90")} />
                      <span className="truncate" title={address}>
                        {address}
                      </span>
                    </button>
                    {!closed &&
                      (box?.error ? (
                        <p className="px-3 py-1 text-[12px] leading-snug text-snow/45" title={graphErrorMessage(box.error)}>
                          Kein Zugriff auf dieses Postfach
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {FOLDERS.map(({ key, label }) => {
                            const info = box?.folders?.find((f) => f.key === key);
                            if (box?.folders && !info) return null;
                            const Icon = FOLDER_ICON[key];
                            const count = key === "drafts" ? info?.totalItemCount : info?.unreadItemCount;
                            const active = mailbox === address && folder === key;
                            return (
                              <li key={key}>
                                <button
                                  type="button"
                                  onClick={() => openFolder(key, address)}
                                  aria-current={active ? "true" : undefined}
                                  className={cn(
                                    "flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[14px] transition-colors",
                                    active ? "bg-snow/[0.1] font-medium text-snow" : "text-snow/70 hover:bg-snow/[0.05] hover:text-snow"
                                  )}
                                >
                                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                                  <span className="flex-1 truncate text-left">{label}</span>
                                  {!!count && (
                                    <span
                                      className="text-[12px] font-semibold"
                                      style={key === "inbox" ? { color: accentText(MAIL_ACCENT) } : undefined}
                                    >
                                      {count}
                                    </span>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ))}
                  </div>
                );
              })}
            </nav>
          )}

          {/* Liste */}
          <section
            aria-label={folderLabel}
            className={cn(
              "flex min-w-0 flex-col border-r border-snow/[0.08] md:w-[360px] md:shrink-0 lg:w-[400px]",
              showDetail ? "hidden md:flex" : "flex w-full"
            )}
          >
            <div className="shrink-0 px-4 pt-3">
              <div className="flex items-center gap-2">
                <h2 className="hidden min-w-0 flex-1 truncate text-[17px] font-medium md:block">
                  {query ? `Suche: „${query}“` : folderLabel}
                  {multiple && <span className="ml-2 text-[13px] font-normal text-snow/45">{mailboxLabel(mailbox)}</span>}
                </h2>
                <Select
                  value={`${mailbox}|${folder}`}
                  onChange={(e) => {
                    const [address, key] = e.target.value.split("|");
                    openFolder(key as FolderKey, address);
                  }}
                  className="h-9 flex-1 md:hidden"
                  aria-label="Ordner"
                >
                  {mailboxes.map((address) => (
                    <optgroup key={address} label={address}>
                      {FOLDERS.map(({ key, label }) => (
                        <option key={key} value={`${address}|${key}`}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              {useTabs && (
                <div role="tablist" className="mt-2 flex gap-5 border-b border-snow/[0.08] text-[14px]">
                  {(
                    [
                      ["focused", "Relevant"],
                      ["other", "Sonstige"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      onClick={() => {
                        setTab(key);
                        setSelectedId(null);
                      }}
                      className={cn(
                        "-mb-px border-b-2 pb-2 transition-colors",
                        tab === key ? "border-snow font-medium text-snow" : "border-transparent text-snow/55 hover:text-snow"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {list.loading ? (
                <div className="grid h-40 place-items-center">
                  <Spinner />
                </div>
              ) : messages.length === 0 ? (
                <Empty
                  icon={<Inbox className="h-8 w-8" />}
                  title={query ? "Keine Treffer" : "Hier ist nichts"}
                  text={query ? "Versuch einen anderen Suchbegriff." : "Dieser Ordner ist leer."}
                />
              ) : (
                <MessageList
                  messages={messages}
                  selectedId={selectedId}
                  outgoing={outgoing}
                  inbound={inbound}
                  onSelect={select}
                  next={list.data?.next ?? null}
                  loadingMore={loadingMore}
                  onMore={loadMore}
                />
              )}
            </div>
          </section>

          {/* Lesebereich */}
          <section aria-label="Lesebereich" className={cn("min-w-0 flex-1", showDetail ? "block" : "hidden md:block")}>
            {compose ? (
              <Compose
                key={compose.mode === "new" ? `new:${mailbox}` : `${compose.mode}:${compose.source.id}`}
                state={compose}
                mailbox={mailbox}
                fromOptions={mailboxes}
                onClose={() => setCompose(null)}
                onSent={() => {
                  setCompose(null);
                  folders.reload();
                  if (outgoing) list.reload();
                }}
              />
            ) : selected ? (
              <ReadingPane
                key={`${mailbox}:${selected.id}`}
                mailbox={mailbox}
                message={selected}
                inbound={inbound.get(selected.internetMessageId)}
                onReply={(mode) => setCompose({ mode, source: selected })}
                onBack={() => setSelectedId(null)}
              />
            ) : (
              <Empty
                icon={<Mail className="h-10 w-10" />}
                title="Keine Nachricht ausgewählt"
                text="Wähle links eine E-Mail aus, um sie hier zu lesen."
              />
            )}
          </section>
        </div>
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Endgültig löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy === "delete"} loadingText="Wird gelöscht …" onClick={() => removeSelected("delete")}>
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">Die Nachricht wird aus „Gelöschte Elemente“ entfernt und kann nicht wiederhergestellt werden.</p>
      </Dialog>
    </div>
  );
}

function Command({
  icon: Icon,
  label,
  short,
  loading,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  short?: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={label}
      aria-label={label}
      loading={loading}
      icon={<Icon className="h-4 w-4" />}
      onClick={onClick}
      className="px-2.5"
    >
      <span className="hidden xl:inline">{short ?? label}</span>
    </Button>
  );
}
