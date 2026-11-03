"use client";

import type { ReplyMode } from "./reading-pane";

// Neue Mails, Antworten und Weiterleitungen öffnen wie in Outlook ein eigenes
// Fenster (/verfassen). Nach dem Senden meldet es sich über diesen Kanal,
// damit Posteingang und Gesendet sich neu laden.
export const MAIL_CHANNEL = "intranet:mail";

export type ComposeParams =
  | { mode: "new"; from?: string; to?: string }
  | { mode: ReplyMode; mailbox: string; id: string };

export function composeUrl(params: ComposeParams) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return `/verfassen?${query}`;
}

/** Öffnet das Verfassen-Fenster; ohne Pop-ups (z. B. Handy) im selben Tab */
export function openCompose(params: ComposeParams) {
  const url = composeUrl(params);
  const small = window.matchMedia("(max-width: 767px)").matches;
  const popup = small ? null : window.open(url, `verfassen-${Date.now()}`, "popup,width=780,height=780");
  if (!popup) window.location.assign(url);
}

/** Andere Fenster (Posteingang) über eine gesendete Mail informieren */
export function announceSent() {
  try {
    const channel = new BroadcastChannel(MAIL_CHANNEL);
    channel.postMessage({ type: "sent" });
    channel.close();
  } catch {}
}
