"use client";

import { Fragment } from "react";
import { Flag, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Message } from "@/lib/graph";
import type { InboundMessage } from "@/lib/sales/types";
import { accentFill, accentText } from "@/lib/theme";
import { Avatar, Button } from "@/components/ui";
import { groupLabel, listName, listTime } from "./format";

/** Akzent für ungelesen/ausgewählt wie das Outlook-Blau */
export const MAIL_ACCENT = "#4f9bf0";

const CLASSIFICATION = {
  anfrage: { label: "Anfrage → Lead", color: "#5bbf6a" },
  bewerbung: { label: "Bewerbung", color: "#a77ff0" },
} as const;

export function ClassificationChip({ inbound }: { inbound?: InboundMessage }) {
  if (!inbound || inbound.classification === "sonstiges") return null;
  const { label, color } = CLASSIFICATION[inbound.classification];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10.5px] font-medium leading-4"
      style={{ background: accentFill(color, 16), color: accentText(color) }}
      title={inbound.reason ?? undefined}
    >
      {label}
    </span>
  );
}

export function MessageList({
  messages,
  selectedId,
  outgoing,
  inbound,
  onSelect,
  next,
  loadingMore,
  onMore,
}: {
  messages: Message[];
  selectedId: string | null;
  outgoing: boolean;
  inbound: Map<string, InboundMessage>;
  onSelect: (message: Message) => void;
  next: string | null;
  loadingMore: boolean;
  onMore: () => void;
}) {
  const groups = messages.map((message) => groupLabel(message.receivedDateTime));
  return (
    <ul role="listbox" aria-label="Nachrichten" className="flex flex-col">
      {messages.map((message, index) => {
        const group = groups[index];
        const showGroup = index === 0 || group !== groups[index - 1];
        const selected = message.id === selectedId;
        const unread = !message.isRead && !outgoing;
        const name = listName(message, outgoing);
        return (
          <Fragment key={message.id}>
            {showGroup && (
              <li className="sticky top-0 z-[1] bg-canvas/95 px-4 pt-3 pb-1.5 text-[12px] font-medium text-snow/55 backdrop-blur">
                {group}
              </li>
            )}
            <li role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelect(message)}
                className={cn(
                  "relative flex w-full gap-3 border-b border-snow/[0.06] px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-snow",
                  selected ? "bg-snow/[0.1]" : "hover:bg-snow/[0.045]"
                )}
              >
                {(unread || selected) && (
                  <span
                    className="absolute inset-y-0 left-0 w-[3px]"
                    style={{ background: unread ? MAIL_ACCENT : "var(--color-snow)" }}
                    aria-hidden
                  />
                )}
                <Avatar name={name} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[14px]", unread ? "font-semibold text-snow" : "text-snow/85")}>
                      {message.isDraft && <span className="mr-1 text-error">[Entwurf]</span>}
                      {name}
                    </span>
                    <span
                      className={cn("shrink-0 text-[12px]", !unread && "text-snow/45")}
                      style={unread ? { color: accentText(MAIL_ACCENT) } : undefined}
                    >
                      {listTime(message.receivedDateTime)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "font-semibold" : "text-snow/80")}
                      style={unread ? { color: accentText(MAIL_ACCENT) } : undefined}
                    >
                      {message.subject || "(Kein Betreff)"}
                    </span>
                    {message.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-snow/45" aria-label="Anhang" />}
                    {message.flag.flagStatus === "flagged" && (
                      <Flag className="h-3.5 w-3.5 shrink-0 fill-current text-error" aria-label="Gekennzeichnet" />
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-snow/50">{message.bodyPreview || " "}</span>
                    <ClassificationChip inbound={inbound.get(message.internetMessageId)} />
                  </span>
                </span>
              </button>
            </li>
          </Fragment>
        );
      })}
      {next && (
        <li className="flex justify-center p-4">
          <Button size="sm" onClick={onMore} loading={loadingMore} loadingText="Wird geladen …">
            Weitere laden
          </Button>
        </li>
      )}
    </ul>
  );
}
