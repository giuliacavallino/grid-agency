"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getGraphToken } from "./auth";
import { CALENDAR_SCOPES, DEMO, MAIL_SCOPES } from "./config";
import { demoGraphFor } from "./graph-demo";

// Microsoft Graph für die Postfächer aus MAILBOXES (delegiert, mit dem Login
// der Person). graphFor(adresse) liefert den Client für ein Postfach. Im
// Vorschaumodus (DEMO) antworten Beispieldaten.

const GRAPH = "https://graph.microsoft.com/v1.0";

// ---------- Typen ----------

export type Recipient = { emailAddress: { name?: string; address: string } };

/** Ordner werden über ihre Graph-Standardnamen angesprochen. */
export const FOLDERS = [
  { key: "inbox", label: "Posteingang" },
  { key: "drafts", label: "Entwürfe" },
  { key: "sentitems", label: "Gesendete Elemente" },
  { key: "archive", label: "Archiv" },
  { key: "deleteditems", label: "Gelöschte Elemente" },
  { key: "junkemail", label: "Junk-E-Mail" },
] as const;
export type FolderKey = (typeof FOLDERS)[number]["key"];

export type MailFolder = { key: FolderKey; id: string; unreadItemCount: number; totalItemCount: number };

export type Message = {
  id: string;
  internetMessageId: string;
  subject: string | null;
  bodyPreview: string;
  receivedDateTime: string;
  sentDateTime?: string;
  from?: Recipient;
  toRecipients: Recipient[];
  ccRecipients: Recipient[];
  isRead: boolean;
  isDraft?: boolean;
  hasAttachments: boolean;
  flag: { flagStatus: "notFlagged" | "flagged" | "complete" };
  inferenceClassification?: "focused" | "other";
  body?: { contentType: "html" | "text"; content: string };
};

export type Attachment = { id: string; name: string; contentType: string; size: number; isInline: boolean };

export type Page<T> = { items: T[]; next: string | null };

export type Draft = { to: string[]; cc: string[]; subject: string; body: string };

/** Dateianhang mit Inhalt (Base64), z. B. zum Weiterleiten an DATEV */
export type FileAttachment = { name: string; contentType: string; contentBytes: string };

export type Calendar = {
  id: string;
  /** Postfach, zu dem der Kalender gehört */
  mailbox: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
};

export type CalEvent = {
  id: string;
  calendarId: string;
  subject: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location: string | null;
  organizer: string | null;
  attendees: { name: string; address: string; response: string }[];
  joinUrl: string | null;
  bodyPreview: string;
  webLink: string | null;
};

export type NewEvent = {
  subject: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location: string;
};

export interface GraphApi {
  folders(): Promise<MailFolder[]>;
  messages(opts: { folder: FolderKey; focused?: boolean | null; search?: string; next?: string | null }): Promise<Page<Message>>;
  message(id: string): Promise<Message>;
  attachments(id: string): Promise<Attachment[]>;
  download(messageId: string, attachmentId: string): Promise<Blob>;
  update(id: string, patch: { isRead?: boolean; flag?: Message["flag"] }): Promise<void>;
  move(id: string, destination: FolderKey): Promise<void>;
  remove(id: string): Promise<void>;
  send(draft: Draft, attachments?: FileAttachment[]): Promise<void>;
  /** Dateianhänge einer Mail mit Inhalt (ohne eingebettete Bilder) */
  files(id: string): Promise<FileAttachment[]>;
  reply(id: string, opts: { comment: string; all: boolean }): Promise<void>;
  forward(id: string, opts: { to: string[]; comment: string }): Promise<void>;
  calendars(): Promise<Calendar[]>;
  events(calendar: Calendar, start: Date, end: Date): Promise<CalEvent[]>;
  createEvent(calendarId: string, input: NewEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}

// ---------- Fehler ----------

export class GraphError extends Error {
  constructor(public status: number, public code: string | undefined, message: string, public mailbox?: string) {
    super(message);
  }
}

export const isAccessDenied = (error: unknown) =>
  error instanceof GraphError && (error.status === 403 || error.status === 404 || error.code === "ErrorAccessDenied");

/** Verständliche Meldung für die häufigsten Graph-Fehler. */
export function graphErrorMessage(error: unknown) {
  if (error instanceof GraphError) {
    if (isAccessDenied(error)) {
      return `Dein Konto hat keinen Zugriff auf ${error.mailbox ?? "das Postfach"}. Bitte in Exchange „Vollzugriff“ (und „Senden als“) auf das Postfach geben lassen.`;
    }
    if (error.status === 429) return "Microsoft bremst gerade die Anfragen. Bitte gleich nochmal versuchen.";
  }
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

// ---------- Echter Graph-Client ----------

async function graphFetch(mailbox: string, path: string, scopes: string[], init: RequestInit = {}) {
  const token = await getGraphToken(scopes);
  const response = await fetch(path.startsWith("http") ? path : `${GRAPH}/users/${mailbox}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new GraphError(response.status, body?.error?.code, body?.error?.message ?? `Graph ${response.status}`, mailbox);
  }
  return response;
}


const MESSAGE_FIELDS = [
  "id", "internetMessageId", "subject", "bodyPreview", "receivedDateTime", "sentDateTime", "from",
  "toRecipients", "ccRecipients", "isRead", "isDraft", "hasAttachments", "flag", "inferenceClassification",
].join(",");

const recipients = (addresses: string[]): Recipient[] =>
  addresses.map((address) => ({ emailAddress: { address } }));

/** Graph liefert mit outlook.timezone lokale Zeit ohne Zone: als lokale Zeit lesen. */
const localDate = (value: string) => new Date(value.replace(/\.\d+$/, ""));

function localString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

// Outlook-Kalenderfarben (Enum „color“), falls hexColor leer ist
const CALENDAR_COLORS: Record<string, string> = {
  lightBlue: "#4f9bf0", lightGreen: "#5bbf6a", lightOrange: "#f29c38", lightGray: "#9a948b",
  lightYellow: "#e7c13e", lightTeal: "#3fb7b0", lightPink: "#ef6fa8", lightBrown: "#b58a62",
  lightRed: "#ec5b54", maxColor: "#a77ff0", auto: "#4f9bf0",
};

function realGraph(mailbox: string): GraphApi {
  const mail = (path: string, init?: RequestInit) => graphFetch(mailbox, path, MAIL_SCOPES, init);
  const cal = (path: string, init?: RequestInit) => graphFetch(mailbox, path, CALENDAR_SCOPES, init);
  return {
    async folders() {
      const results = await Promise.allSettled(
        FOLDERS.map(async ({ key }) => {
          const folder = await (await mail(`/mailFolders/${key}?$select=id,unreadItemCount,totalItemCount`)).json();
          return { key, id: folder.id, unreadItemCount: folder.unreadItemCount, totalItemCount: folder.totalItemCount };
        })
      );
      // Archiv gibt es nicht in jedem Postfach; den Posteingang aber immer.
      const inbox = results[0];
      if (inbox.status === "rejected") throw inbox.reason;
      return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    },

    async messages({ folder, focused, search, next }) {
      let url: string;
      if (next) url = next;
      else if (search) {
        url = `/mailFolders/${folder}/messages?$search=${encodeURIComponent(`"${search.replace(/"/g, "")}"`)}&$select=${MESSAGE_FIELDS}&$top=40`;
      } else {
        // $orderby verlangt dieselbe Eigenschaft zuerst im $filter
        const filters = ["receivedDateTime ge 1900-01-01T00:00:00Z"];
        if (focused !== undefined && focused !== null) {
          filters.push(`inferenceClassification eq '${focused ? "focused" : "other"}'`);
        }
        url = `/mailFolders/${folder}/messages?$select=${MESSAGE_FIELDS}&$top=40&$orderby=receivedDateTime desc&$filter=${encodeURIComponent(filters.join(" and "))}`;
      }
      const data = await (await mail(url)).json();
      return { items: data.value, next: data["@odata.nextLink"] ?? null };
    },

    async message(id) {
      const response = await mail(`/messages/${id}?$select=${MESSAGE_FIELDS},body`, {
        headers: { Prefer: 'outlook.body-content-type="html"' },
      });
      return response.json();
    },

    async attachments(id) {
      const data = await (await mail(`/messages/${id}/attachments?$select=id,name,contentType,size,isInline`)).json();
      return data.value;
    },

    async download(messageId, attachmentId) {
      return (await mail(`/messages/${messageId}/attachments/${attachmentId}/$value`)).blob();
    },

    async update(id, patch) {
      await mail(`/messages/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    },

    async move(id, destination) {
      await mail(`/messages/${id}/move`, { method: "POST", body: JSON.stringify({ destinationId: destination }) });
    },

    async remove(id) {
      await mail(`/messages/${id}`, { method: "DELETE" });
    },

    async send(draft, attachments = []) {
      await mail(`/sendMail`, {
        method: "POST",
        body: JSON.stringify({
          message: {
            subject: draft.subject,
            body: { contentType: "Text", content: draft.body },
            toRecipients: recipients(draft.to),
            ccRecipients: recipients(draft.cc),
            attachments: attachments.map((a) => ({ "@odata.type": "#microsoft.graph.fileAttachment", ...a })),
          },
          saveToSentItems: true,
        }),
      });
    },

    async files(id) {
      const data = await (await mail(`/messages/${id}/attachments`)).json();
      return (data.value as (FileAttachment & { "@odata.type": string; isInline: boolean })[])
        .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment" && !a.isInline)
        .map(({ name, contentType, contentBytes }) => ({ name, contentType, contentBytes }));
    },

    async reply(id, { comment, all }) {
      await mail(`/messages/${id}/${all ? "replyAll" : "reply"}`, { method: "POST", body: JSON.stringify({ comment }) });
    },

    async forward(id, { to, comment }) {
      await mail(`/messages/${id}/forward`, {
        method: "POST",
        body: JSON.stringify({ comment, toRecipients: recipients(to) }),
      });
    },

    async calendars() {
      const data = await (await cal(`/calendars?$select=id,name,color,hexColor,isDefaultCalendar,canEdit&$top=50`)).json();
      return data.value.map((c: { id: string; name: string; color: string; hexColor: string; isDefaultCalendar: boolean; canEdit: boolean }) => ({
        id: c.id,
        mailbox,
        name: c.name,
        color: c.hexColor || CALENDAR_COLORS[c.color] || CALENDAR_COLORS.auto,
        isDefaultCalendar: c.isDefaultCalendar,
        canEdit: c.canEdit,
      }));
    },

    async events(calendar, start, end) {
      const fields = "id,subject,start,end,isAllDay,location,organizer,attendees,onlineMeeting,bodyPreview,webLink";
      let url: string | null =
        `/calendars/${calendar.id}/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$select=${fields}&$top=200&$orderby=start/dateTime`;
      const events: CalEvent[] = [];
      while (url) {
        const response = await cal(url, { headers: { Prefer: 'outlook.timezone="Europe/Berlin"' } });
        const data = await response.json();
        for (const e of data.value) {
          events.push({
            id: e.id,
            calendarId: calendar.id,
            subject: e.subject || "(Kein Titel)",
            start: localDate(e.start.dateTime),
            end: localDate(e.end.dateTime),
            isAllDay: e.isAllDay,
            location: e.location?.displayName || null,
            organizer: e.organizer?.emailAddress?.name ?? null,
            attendees: (e.attendees ?? []).map((a: { emailAddress: { name: string; address: string }; status?: { response: string } }) => ({
              name: a.emailAddress.name,
              address: a.emailAddress.address,
              response: a.status?.response ?? "none",
            })),
            joinUrl: e.onlineMeeting?.joinUrl ?? null,
            bodyPreview: e.bodyPreview ?? "",
            webLink: e.webLink ?? null,
          });
        }
        url = data["@odata.nextLink"] ?? null;
      }
      return events;
    },

    async createEvent(calendarId, input) {
      await cal(`/calendars/${calendarId}/events`, {
        method: "POST",
        body: JSON.stringify({
          subject: input.subject,
          isAllDay: input.isAllDay,
          start: { dateTime: localString(input.start), timeZone: "Europe/Berlin" },
          end: { dateTime: localString(input.end), timeZone: "Europe/Berlin" },
          location: input.location ? { displayName: input.location } : undefined,
        }),
      });
    },

    async deleteEvent(id) {
      await cal(`/events/${id}`, { method: "DELETE" });
    },
  };
}

const clients = new Map<string, GraphApi>();

/** Graph-Client für ein Postfach (Adresse aus MAILBOXES). */
export function graphFor(mailbox: string): GraphApi {
  const key = mailbox.toLowerCase();
  let client = clients.get(key);
  if (!client) {
    client = DEMO ? demoGraphFor(key) : realGraph(key);
    clients.set(key, client);
  }
  return client;
}

// ---------- Hook für asynchrone Daten ----------

/** Lädt Daten für einen Schlüssel; bei neuem Schlüssel neu, reload() lädt
 * still im Hintergrund nach. setData erlaubt optimistische Änderungen. */
export function useAsync<T>(key: string | null, fetcher: () => Promise<T>) {
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });
  const [state, setState] = useState<{ key: string | null; data?: T; error?: unknown }>({ key: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetcherRef.current().then(
      (data) => !cancelled && setState({ key, data }),
      (error) => !cancelled && setState({ key, error })
    );
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const current = state.key === key;
  const setData = useCallback(
    (update: (data: T) => T) =>
      setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) })),
    []
  );
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && !current,
    reload: useCallback(() => setNonce((n) => n + 1), []),
    setData,
  };
}
