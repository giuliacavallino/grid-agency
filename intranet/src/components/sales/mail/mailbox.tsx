"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  Ban,
  CalendarPlus,
  ChevronDown,
  FileText,
  Flag,
  Folder,
  FolderInput,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  PanelLeft,
  Reply,
  ReplyAll,
  Search,
  Send,
  SquarePen,
  Trash2,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ConsentRequiredError } from "@/lib/auth";
import { MAIL_SCOPES, mailboxLabel } from "@/lib/config";
import { useResource } from "@/lib/data";
import {
  FOLDERS,
  graphFor,
  graphErrorMessage,
  useAsync,
  type ChildFolder,
  type FolderKey,
  type FolderRef,
  type MailFolder,
  type Message,
  type MessageFilter,
} from "@/lib/graph";
import type { InboundMessage } from "@/lib/sales/types";
import { useMe } from "@/components/access";
import { Button, Dialog, Empty, Popover, Spinner, useToast } from "@/components/ui";
import { NewLeadDialog } from "../lead-sheet";
import { GraphProblem } from "./access";
import { MAIL_CHANNEL, composeUrl, openCompose } from "./compose-window";
import { MessageList, type MailItem } from "./message-list";
import { ReadingPane } from "./reading-pane";

const FOLDER_ICON: Record<FolderKey, LucideIcon> = {
  inbox: Inbox,
  drafts: FileText,
  sentitems: Send,
  archive: Archive,
  deleteditems: Trash2,
  junkemail: Ban,
};

const OUTGOING: FolderRef[] = ["sentitems", "drafts"];

/** Sammelansichten über alle Postfächer oder ein Ordner eines Postfachs */
type View =
  | { kind: "smart"; id: "inbox" | "sent" | "unread" | "flagged" }
  | { kind: "folder"; mailbox: string; folder: FolderRef; label: string };

const SMART: { id: Extract<View, { kind: "smart" }>["id"]; label: string; icon: LucideIcon; folder: FolderKey; filter?: MessageFilter }[] = [
  { id: "inbox", label: "Alle Posteingänge", icon: Inbox, folder: "inbox" },
  { id: "sent", label: "Alle Gesendeten", icon: Send, folder: "sentitems" },
  { id: "unread", label: "Ungelesen", icon: Mail, folder: "inbox", filter: "unread" },
  { id: "flagged", label: "Gekennzeichnet", icon: Flag, folder: "inbox", filter: "flagged" },
];

type MailboxFolders = { mailbox: string; folders?: MailFolder[]; error?: unknown };
type ListData = { items: MailItem[]; next: Record<string, string | null>; denied: string[] };

const byDate = (a: MailItem, b: MailItem) => b.receivedDateTime.localeCompare(a.receivedDateTime);
const keyOf = (m: { mailbox: string; id: string }) => `${m.mailbox}:${m.id}`;

/** Posteingang im Aufbau von Outlook: Ordnerleiste mit Sammelordnern und allen
 * Postfächern samt Unterordnern, Liste als Karten, Befehlsleiste und
 * Lesebereich. Neue Mails öffnen ein eigenes Fenster. */
export function Mailbox({ mailboxes }: { mailboxes: string[] }) {
  const params = useSearchParams();
  const toast = useToast();
  const me = useMe();
  const multiple = mailboxes.length > 1;
  const [view, setView] = useState<View>(() =>
    multiple ? { kind: "smart", id: "inbox" } : { kind: "folder", mailbox: mailboxes[0], folder: "inbox", label: "Posteingang" }
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [busy, setBusy] = useState<"delete" | "archive" | "move" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);

  // ?to=adresse (z. B. aus Sales) öffnet direkt eine neue Mail
  useEffect(() => {
    const to = params.get("to");
    if (to) window.location.replace(composeUrl({ mode: "new", to }));
  }, [params]);

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

  const smart = view.kind === "smart" ? SMART.find((s) => s.id === view.id)! : null;
  const boxes = view.kind === "smart" ? mailboxes : [view.mailbox];
  const folder: FolderRef = smart ? smart.folder : view.kind === "folder" ? view.folder : "inbox";
  const filter = smart?.filter;
  const listKey = `${boxes.join()}|${folder}|${filter ?? ""}|${query}`;
  const list = useAsync<ListData>(listKey, async () => {
    const results = await Promise.allSettled(
      boxes.map((mailbox) => graphFor(mailbox).messages({ folder, filter, search: query || undefined }).then((page) => ({ mailbox, page })))
    );
    const failed = results.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
    if (failed.length === results.length) throw failed[0];
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    return {
      items: ok.flatMap(({ mailbox, page }) => page.items.map((m) => ({ ...m, mailbox }))).sort(byDate),
      next: Object.fromEntries(ok.map(({ mailbox, page }) => [mailbox, page.next])),
      denied: boxes.filter((_, i) => results[i].status === "rejected"),
    };
  });
  const messages = useMemo(() => list.data?.items ?? [], [list.data]);
  const selected = messages.find((m) => keyOf(m) === selectedKey) ?? null;
  const outgoing = OUTGOING.includes(folder);
  const hasMore = Object.values(list.data?.next ?? {}).some(Boolean);

  // Gesendet im anderen Fenster: Liste und Zähler neu laden
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(MAIL_CHANNEL);
      channel.onmessage = () => {
        folders.reload();
        list.reload();
      };
    } catch {}
    return () => channel?.close();
  }, [folders, list]);

  // Einordnung durch den Mail-Abgleich (Anfrage → Lead / Bewerbung). Nur für
  // die ersten 40 Mails, damit die URL beim Weiterblättern kurz bleibt.
  const ids = messages.map((m) => m.internetMessageId).filter(Boolean).slice(0, 40);
  const { data: inboundRows } = useResource<InboundMessage[]>(
    ids.length ? `/api/sales/inbound_messages?ids=${encodeURIComponent(ids.join(","))}` : null
  );
  const inbound = useMemo(() => new Map((inboundRows ?? []).map((row) => [row.id, row])), [inboundRows]);

  // Fehlende Zustimmung gilt für alle Postfächer: dann die große Abfrage zeigen
  const consent = folders.data?.find((f) => f.error instanceof ConsentRequiredError)?.error;
  const problem = consent ?? folders.error ?? list.error;

  const mailboxName = (address: string) => (address.toLowerCase() === me.data?.email.toLowerCase() ? "Mein Postfach" : mailboxLabel(address));
  const unreadInbox = (folders.data ?? []).reduce((sum, box) => sum + (box.folders?.find((f) => f.key === "inbox")?.unreadItemCount ?? 0), 0);

  function patchMessage(target: MailItem, patch: Partial<Message>) {
    list.setData((data) => ({ ...data, items: data.items.map((m) => (keyOf(m) === keyOf(target) ? { ...m, ...patch } : m)) }));
  }

  function changeUnread(mailbox: string, delta: number) {
    folders.setData((all) =>
      all.map((box) =>
        box.mailbox !== mailbox || !box.folders
          ? box
          : { ...box, folders: box.folders.map((f) => (f.key === "inbox" ? { ...f, unreadItemCount: Math.max(0, f.unreadItemCount + delta) } : f)) }
      )
    );
  }

  function select(message: MailItem) {
    setSelectedKey(keyOf(message));
    if (!message.isRead && !outgoing) {
      patchMessage(message, { isRead: true });
      changeUnread(message.mailbox, -1);
      graphFor(message.mailbox)
        .update(message.id, { isRead: true })
        .catch(() => {
          patchMessage(message, { isRead: false });
          changeUnread(message.mailbox, 1);
        });
    }
  }

  function open(next: View) {
    setView(next);
    setSelectedKey(null);
    setQuery("");
    setSearchInput("");
  }

  async function toggleRead() {
    if (!selected) return;
    const isRead = !selected.isRead;
    patchMessage(selected, { isRead });
    changeUnread(selected.mailbox, isRead ? -1 : 1);
    try {
      await graphFor(selected.mailbox).update(selected.id, { isRead });
    } catch {
      toast("Ändern fehlgeschlagen", "error");
      list.reload();
    }
  }

  async function toggleFlag() {
    if (!selected) return;
    const flag = { flagStatus: selected.flag.flagStatus === "flagged" ? "notFlagged" : "flagged" } as const;
    patchMessage(selected, { flag });
    try {
      await graphFor(selected.mailbox).update(selected.id, { flag });
    } catch {
      toast("Kennzeichnen fehlgeschlagen", "error");
      list.reload();
    }
  }

  /** Verschieben, archivieren oder löschen; danach die nächste Nachricht wählen. */
  async function moveSelected(kind: "delete" | "archive" | "move", destination?: FolderRef, label?: string) {
    if (!selected) return;
    const index = messages.findIndex((m) => keyOf(m) === keyOf(selected));
    const nextMessage = messages[index + 1] ?? messages[index - 1] ?? null;
    const graph = graphFor(selected.mailbox);
    setBusy(kind);
    try {
      if (kind === "archive") await graph.move(selected.id, "archive");
      else if (kind === "move") await graph.move(selected.id, destination!);
      else if (folder === "deleteditems") await graph.remove(selected.id);
      else await graph.move(selected.id, "deleteditems");
      list.setData((data) => ({ ...data, items: data.items.filter((m) => keyOf(m) !== keyOf(selected)) }));
      setSelectedKey(nextMessage ? keyOf(nextMessage) : null);
      folders.reload();
      toast(kind === "archive" ? "Archiviert" : kind === "move" ? `Verschoben nach „${label}“` : folder === "deleteditems" ? "Endgültig gelöscht" : "Gelöscht");
    } catch {
      toast("Das hat nicht geklappt", "error");
    }
    setBusy(null);
    setConfirmDelete(false);
  }

  async function loadMore() {
    const next = list.data?.next ?? {};
    setLoadingMore(true);
    try {
      const pages = await Promise.all(
        Object.entries(next)
          .filter(([, link]) => link)
          .map(([mailbox, link]) => graphFor(mailbox).messages({ folder, next: link }).then((page) => ({ mailbox, page })))
      );
      list.setData((data) => ({
        ...data,
        items: [...data.items, ...pages.flatMap(({ mailbox, page }) => page.items.map((m) => ({ ...m, mailbox })))].sort(byDate),
        next: { ...data.next, ...Object.fromEntries(pages.map(({ mailbox, page }) => [mailbox, page.next])) },
      }));
    } catch {
      toast("Weitere Nachrichten konnten nicht geladen werden", "error");
    }
    setLoadingMore(false);
  }

  const title = smart ? smart.label : view.kind === "folder" ? view.label : "";
  const subtitle = view.kind === "folder" && multiple ? mailboxName(view.mailbox) : null;
  const isActive = (candidate: View) =>
    candidate.kind === "smart"
      ? view.kind === "smart" && view.id === candidate.id
      : view.kind === "folder" && view.mailbox === candidate.mailbox && view.folder === candidate.folder;

  return (
    <div className="flex h-full bg-canvas">
      {problem ? (
        <div className="flex-1">
          <GraphProblem
            error={problem}
            scopes={MAIL_SCOPES}
            onRetry={() => {
              folders.reload();
              list.reload();
            }}
          />
        </div>
      ) : (
        <>
          {/* Ordner */}
          {foldersOpen && (
            <nav aria-label="Ordner" className="hidden w-64 shrink-0 overflow-y-auto border-r border-snow/[0.06] bg-sky/60 px-2.5 pt-5 pb-4 lg:block">
              {multiple && (
                <>
                  <p className="mb-1.5 flex items-center gap-2 px-3 text-[13px] font-semibold text-snow/80">
                    <Inbox className="h-4 w-4" /> Alle Postfächer
                  </p>
                  <ul className="mb-3 flex flex-col gap-0.5 border-b border-snow/[0.08] pb-3">
                    {SMART.map((item) => (
                      <li key={item.id}>
                        <FolderButton
                          icon={item.icon}
                          label={item.label}
                          count={item.id === "inbox" ? unreadInbox : undefined}
                          active={isActive({ kind: "smart", id: item.id })}
                          onClick={() => open({ kind: "smart", id: item.id })}
                          indent={1}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {mailboxes.map((address) => {
                const box = folders.data?.find((f) => f.mailbox === address);
                const closed = collapsed.has(address);
                return (
                  <div key={address} className="mb-2">
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
                      className="mb-1 flex h-10 w-full items-center gap-2 rounded-xl bg-snow/[0.08] px-2.5 text-left text-[13px] font-semibold text-snow/85 hover:bg-snow/[0.12]"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", closed && "-rotate-90")} />
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate" title={address}>
                        {address}
                      </span>
                    </button>
                    {!closed &&
                      (box?.error ? (
                        <p className="px-9 py-1 text-[12px] leading-snug text-snow/45" title={graphErrorMessage(box.error)}>
                          Kein Zugriff auf dieses Postfach
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-0.5">
                          {FOLDERS.map(({ key, label }) => {
                            const info = box?.folders?.find((f) => f.key === key);
                            if (box?.folders && !info) return null;
                            const count = key === "drafts" ? info?.totalItemCount : info?.unreadItemCount;
                            const candidate: View = { kind: "folder", mailbox: address, folder: key, label };
                            return (
                              <li key={key}>
                                {key === "inbox" ? (
                                  <FolderTree
                                    mailbox={address}
                                    node={{ id: "inbox", name: label, unreadItemCount: count ?? 0, totalItemCount: 0, childFolderCount: 1 }}
                                    icon={Inbox}
                                    depth={1}
                                    isActive={isActive}
                                    onOpen={open}
                                  />
                                ) : (
                                  <FolderButton icon={FOLDER_ICON[key]} label={label} count={count} active={isActive(candidate)} onClick={() => open(candidate)} indent={1} />
                                )}
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
            aria-label={title}
            className={cn("flex min-w-0 flex-col bg-sky/40 md:w-[380px] md:shrink-0 xl:w-[420px]", selected ? "hidden md:flex" : "flex w-full")}
          >
            <div className="shrink-0 px-4 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold">
                  {query ? `Suche: „${query}“` : title}
                  {subtitle && <span className="ml-2 text-[13px] font-normal text-snow/45">{subtitle}</span>}
                </h2>
                {/* Handy: Ordnerwahl und neue Mail */}
                <select
                  value={view.kind === "smart" ? `smart|${view.id}` : `${view.mailbox}|${view.folder}`}
                  onChange={(e) => {
                    const [a, b] = e.target.value.split("|");
                    if (a === "smart") open({ kind: "smart", id: b as Extract<View, { kind: "smart" }>["id"] });
                    else open({ kind: "folder", mailbox: a, folder: b, label: FOLDERS.find((f) => f.key === b)?.label ?? b });
                  }}
                  className="h-9 max-w-40 rounded-full border border-snow/12 bg-surface px-3 text-[13px] lg:hidden"
                  aria-label="Ordner"
                >
                  {multiple && (
                    <optgroup label="Alle Postfächer">
                      {SMART.map((s) => (
                        <option key={s.id} value={`smart|${s.id}`}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {mailboxes.map((address) => (
                    <optgroup key={address} label={address}>
                      {FOLDERS.map(({ key, label }) => (
                        <option key={key} value={`${address}|${key}`}>
                          {label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Neue E-Mail"
                  onClick={() => openCompose({ mode: "new", from: view.kind === "folder" ? view.mailbox : undefined })}
                  className="grid h-9 w-9 place-items-center rounded-full bg-snow text-sky md:hidden"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </div>
              <form
                className="relative mt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  setQuery(searchInput.trim());
                  setSelectedKey(null);
                }}
              >
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-snow/40" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="In diesem Ordner suchen …"
                  aria-label="E-Mails durchsuchen"
                  className="h-10 w-full rounded-full border border-snow/[0.08] bg-surface pr-9 pl-10 text-[14px] outline-none placeholder:text-snow/40 focus:border-snow/30"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Suche zurücksetzen"
                    onClick={() => {
                      setQuery("");
                      setSearchInput("");
                    }}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-snow/50 hover:text-snow"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>
              {!!list.data?.denied.length && (
                <p className="mt-2 px-1 text-[12px] text-snow/45">Ohne Zugriff: {list.data.denied.map(mailboxLabel).join(", ")}</p>
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
                  selectedKey={selectedKey}
                  outgoing={outgoing}
                  inbound={inbound}
                  mailboxName={mailboxName}
                  onSelect={select}
                  hasMore={hasMore}
                  loadingMore={loadingMore}
                  onMore={loadMore}
                />
              )}
            </div>
          </section>

          {/* Befehlsleiste und Lesebereich */}
          <section aria-label="Lesebereich" className={cn("flex min-w-0 flex-1 flex-col bg-surface", selected ? "flex" : "hidden md:flex")}>
            <div role="toolbar" aria-label="Befehle" className="flex shrink-0 flex-wrap items-center gap-1 border-b border-snow/[0.08] bg-sky/50 px-3 py-3 md:px-5">
              <button
                type="button"
                title="Neue E-Mail"
                aria-label="Neue E-Mail"
                onClick={() => openCompose({ mode: "new", from: selected?.mailbox ?? (view.kind === "folder" ? view.mailbox : undefined) })}
                className="mr-1 hidden h-11 w-[84px] place-items-center rounded-2xl bg-snow text-sky shadow-[0_6px_18px_var(--shadow-color)] transition-opacity hover:opacity-90 md:grid"
              >
                <SquarePen className="h-5 w-5" />
              </button>
              <Tool icon={CalendarPlus} label="Neuer Termin" href="/mail/kalender?neu=1" />
              <Divider />
              <Tool
                icon={Trash2}
                label="Löschen"
                disabled={!selected}
                loading={busy === "delete"}
                onClick={() => (folder === "deleteditems" ? setConfirmDelete(true) : moveSelected("delete"))}
              />
              {folder !== "archive" && <Tool icon={Archive} label="Archivieren" disabled={!selected} loading={busy === "archive"} onClick={() => moveSelected("archive")} />}
              <Divider />
              <Tool icon={Reply} label="Antworten" disabled={!selected} onClick={() => selected && openCompose({ mode: "reply", mailbox: selected.mailbox, id: selected.id })} />
              <Tool icon={ReplyAll} label="Allen antworten" disabled={!selected} onClick={() => selected && openCompose({ mode: "replyAll", mailbox: selected.mailbox, id: selected.id })} />
              <Tool icon={Forward} label="Weiterleiten" disabled={!selected} onClick={() => selected && openCompose({ mode: "forward", mailbox: selected.mailbox, id: selected.id })} />
              <Divider />
              {selected ? (
                <MoveMenu mailbox={selected.mailbox} busy={busy === "move"} onMove={(destination, label) => moveSelected("move", destination, label)} />
              ) : (
                <Tool icon={FolderInput} label="Verschieben" disabled />
              )}
              <Divider />
              <Tool icon={selected?.isRead === false ? MailOpen : Mail} label={selected?.isRead === false ? "Als gelesen markieren" : "Als ungelesen markieren"} disabled={!selected} onClick={toggleRead} />
              <Tool
                icon={Flag}
                label={selected?.flag.flagStatus === "flagged" ? "Kennzeichnung entfernen" : "Kennzeichnen"}
                disabled={!selected}
                pressed={selected?.flag.flagStatus === "flagged"}
                onClick={toggleFlag}
              />
              <Divider />
              <Tool icon={UserPlus} label="Als Lead anlegen" disabled={!selected} onClick={() => setLeadOpen(true)} />
              <span className="flex-1" />
              <Tool icon={PanelLeft} label="Ordner ein-/ausblenden" onClick={() => setFoldersOpen((o) => !o)} className="hidden lg:grid" />
            </div>

            <div className="min-h-0 flex-1">
              {selected ? (
                <ReadingPane
                  key={keyOf(selected)}
                  mailbox={selected.mailbox}
                  message={selected}
                  inbound={inbound.get(selected.internetMessageId)}
                  folderLabel={smart ? (smart.filter === "flagged" ? "Gekennzeichnet" : (FOLDERS.find((f) => f.key === smart.folder)?.label ?? title)) : title}
                  mailboxName={mailboxName(selected.mailbox)}
                  onLead={() => setLeadOpen(true)}
                  onBack={() => setSelectedKey(null)}
                />
              ) : (
                <div className="grid h-full place-items-center">
                  <Empty icon={<Mail className="h-10 w-10" />} title="Mail auswählen" text="" />
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {selected && (
        <NewLeadDialog
          open={leadOpen}
          onClose={() => setLeadOpen(false)}
          initial={{
            name: selected.from?.emailAddress.name || selected.from?.emailAddress.address || "",
            email: selected.from?.emailAddress.address ?? null,
            source: "email",
            source_ref: selected.internetMessageId,
            message: selected.bodyPreview,
          }}
        />
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
            <Button variant="danger" loading={busy === "delete"} loadingText="Wird gelöscht …" onClick={() => moveSelected("delete")}>
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

function FolderButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  indent = 0,
  expander,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  indent?: number;
  expander?: React.ReactNode;
}) {
  return (
    <div className="flex items-center" style={{ paddingLeft: indent * 14 }}>
      <span className="grid w-5 shrink-0 place-items-center">{expander}</span>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-[13.5px] transition-colors",
          active ? "bg-snow font-medium text-sky shadow-[0_4px_14px_var(--shadow-color)]" : "text-snow/75 hover:bg-snow/[0.06] hover:text-snow"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
        <span className="flex-1 truncate text-left">{label}</span>
        {!!count && <span className={cn("text-[12px] font-semibold", active ? "text-sky/80" : "text-snow/60")}>{count}</span>}
      </button>
    </div>
  );
}

/** Ordner mit aufklappbaren Unterordnern (werden erst beim Aufklappen geladen) */
function FolderTree({
  mailbox,
  node,
  icon,
  depth,
  isActive,
  onOpen,
}: {
  mailbox: string;
  node: ChildFolder;
  icon: LucideIcon;
  depth: number;
  isActive: (view: View) => boolean;
  onOpen: (view: View) => void;
}) {
  const [open, setOpen] = useState(false);
  const children = useAsync(open && node.childFolderCount > 0 ? `children:${mailbox}:${node.id}` : null, () => graphFor(mailbox).childFolders(node.id));
  const candidate: View = { kind: "folder", mailbox, folder: node.id, label: node.name };
  const expandable = node.childFolderCount > 0 && (!children.data || children.data.length > 0);
  return (
    <>
      <FolderButton
        icon={icon}
        label={node.name}
        count={node.unreadItemCount}
        active={isActive(candidate)}
        onClick={() => onOpen(candidate)}
        indent={depth - 1}
        expander={
          expandable ? (
            <button type="button" aria-label={open ? `${node.name} zuklappen` : `${node.name} aufklappen`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="grid h-6 w-5 place-items-center text-snow/55 hover:text-snow">
              {children.loading ? <Spinner className="h-3 w-3" /> : <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />}
            </button>
          ) : null
        }
      />
      {open &&
        children.data?.map((child) => (
          <FolderTree key={child.id} mailbox={mailbox} node={child} icon={Folder} depth={depth + 1} isActive={isActive} onOpen={onOpen} />
        ))}
    </>
  );
}

/** Verschieben in einen Standardordner oder einen Unterordner des Posteingangs */
function MoveMenu({ mailbox, busy, onMove }: { mailbox: string; busy: boolean; onMove: (destination: FolderRef, label: string) => void }) {
  return (
    <Popover
      align="left"
      trigger={({ toggle, open }) => <Tool icon={FolderInput} label="Verschieben" loading={busy} pressed={open} onClick={toggle} />}
    >
      {(close) => <MoveList mailbox={mailbox} onPick={(id, label) => (close(), onMove(id, label))} />}
    </Popover>
  );
}

function MoveList({ mailbox, onPick }: { mailbox: string; onPick: (destination: FolderRef, label: string) => void }) {
  const children = useAsync(`children:${mailbox}:inbox`, () => graphFor(mailbox).childFolders("inbox"));
  const item = "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13.5px] hover:bg-snow/[0.08]";
  return (
    <div className="max-h-80 w-64 overflow-y-auto p-1.5">
      <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-snow/45 uppercase">Verschieben nach</p>
      {FOLDERS.filter((f) => f.key !== "drafts" && f.key !== "sentitems").map(({ key, label }) => {
        const Icon = FOLDER_ICON[key];
        return (
          <button key={key} type="button" className={item} onClick={() => onPick(key, label)}>
            <Icon className="h-4 w-4 text-snow/60" /> {label}
          </button>
        );
      })}
      {children.loading && <Spinner className="m-2 h-4 w-4" />}
      {children.data?.map((child) => (
        <button key={child.id} type="button" className={cn(item, "pl-7")} onClick={() => onPick(child.id, child.name)}>
          <Folder className="h-4 w-4 text-snow/60" /> <span className="truncate">{child.name}</span>
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-6 w-px bg-snow/10" />;
}

function Tool({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  loading,
  pressed,
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  const classes = cn(
    "grid h-10 w-10 place-items-center rounded-xl text-snow/75 transition-colors hover:bg-snow/[0.08] hover:text-snow disabled:pointer-events-none disabled:opacity-35",
    pressed && "bg-snow/[0.1] text-snow",
    className
  );
  if (href) {
    return (
      <Link href={href} title={label} aria-label={label} className={classes}>
        <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
      </Link>
    );
  }
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined} className={classes}>
      {loading ? <Spinner className="h-4 w-4" /> : <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />}
    </button>
  );
}
