"use client";

import { Flag, Inbox, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Message } from "@/lib/graph";
import type { InboundMessage } from "@/lib/sales/types";
import { accentFill, accentText } from "@/lib/theme";
import { Button } from "@/components/ui";
import { listName, listTime } from "./format";

/** Akzent für ungelesen wie das Outlook-Blau */
export const MAIL_ACCENT = "#4f9bf0";

/** Nachricht mit dem Postfach, aus dem sie stammt (Sammelansichten) */
export type MailItem = Message & { mailbox: string };

const CLASSIFICATION = {
  anfrage: { label: "Anfrage → Lead", color: "#5bbf6a" },
  bewerbung: { label: "Bewerbung → Personal", color: "#a77ff0" },
  rechnung: { label: "Rechnung → Finance", color: "#e7a33e" },
} as const;

export function ClassificationChip({ inbound }: { inbound?: InboundMessage }) {
  if (!inbound || inbound.classification === "sonstiges") return null;
  const { label, color } = CLASSIFICATION[inbound.classification];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-4"
      style={{ background: accentFill(color, 16), color: accentText(color) }}
      title={inbound.reason ?? undefined}
    >
      {label}
    </span>
  );
}

/** Kräftiges Kürzel wie in Outlook: Farbe stabil aus dem Namen */
export function MailAvatar({ name, size = 40 }: { name: string; size?: number }) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const hues = [14, 214, 340, 285, 160, 32, 198, 0];
  const hue = hues[Math.abs(hash) % hues.length];
  const letters = name
    .replace(/[<>"]/g, "")
    .split(/[\s@.|]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 62% 48%)` }}
      aria-hidden
    >
      {letters || "?"}
    </span>
  );
}

export function MessageList({
  messages,
  selectedKey,
  outgoing,
  inbound,
  mailboxName,
  onSelect,
  hasMore,
  loadingMore,
  onMore,
}: {
  messages: MailItem[];
  selectedKey: string | null;
  outgoing: boolean;
  inbound: Map<string, InboundMessage>;
  /** Anzeigename des Postfachs für den Chip unter jeder Mail */
  mailboxName: (address: string) => string;
  onSelect: (message: MailItem) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
}) {
  return (
    <ul role="listbox" aria-label="Nachrichten" className="flex flex-col gap-1.5 px-2 pb-4">
      {messages.map((message) => {
        const key = `${message.mailbox}:${message.id}`;
        const selected = key === selectedKey;
        const unread = !message.isRead && !outgoing;
        const flagged = message.flag.flagStatus === "flagged";
        const name = listName(message, outgoing);
        return (
          <li key={key} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => onSelect(message)}
              className={cn(
                "flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition-[background-color,box-shadow] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-snow",
                selected
                  ? "bg-surface shadow-[0_6px_24px_var(--shadow-color)]"
                  : flagged
                    ? "bg-[#f6e7b0]/45 hover:bg-[#f6e7b0]/65"
                    : "hover:bg-surface/70"
              )}
            >
              <MailAvatar name={name} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-[14.5px]", unread || selected ? "font-semibold text-snow" : "font-medium text-snow/85")}>
                    {message.isDraft && <span className="mr-1 text-error">[Entwurf]</span>}
                    {name}
                  </span>
                  <span className="shrink-0 text-[12px] text-snow/50" style={unread ? { color: accentText(MAIL_ACCENT) } : undefined}>
                    {listTime(message.receivedDateTime)}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={cn("min-w-0 flex-1 truncate text-[13.5px]", unread ? "font-semibold" : "text-snow/80")}
                    style={unread ? { color: accentText(MAIL_ACCENT) } : undefined}
                  >
                    {message.subject || "(Kein Betreff)"}
                  </span>
                  {message.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-snow/45" aria-label="Anhang" />}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-snow/50">{message.bodyPreview || " "}</span>
                  {flagged && <Flag className="h-3.5 w-3.5 shrink-0 text-error" aria-label="Gekennzeichnet" />}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-snow/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-snow/70">
                    <Inbox className="h-3 w-3" /> {mailboxName(message.mailbox)}
                  </span>
                  <ClassificationChip inbound={inbound.get(message.internetMessageId)} />
                </span>
              </span>
            </button>
          </li>
        );
      })}
      {hasMore && (
        <li className="flex justify-center p-3">
          <Button size="sm" onClick={onMore} loading={loadingMore} loadingText="Wird geladen …">
            Weitere laden
          </Button>
        </li>
      )}
    </ul>
  );
}
