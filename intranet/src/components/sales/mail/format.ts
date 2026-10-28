import type { Message, Recipient } from "@/lib/graph";

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Gruppen der Nachrichtenliste wie in Outlook */
export function groupLabel(value: string) {
  const today = startOfDay(new Date());
  const day = startOfDay(new Date(value));
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return "Heute";
  if (diff === 1) return "Gestern";
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  if (day >= weekStart) return "Diese Woche";
  return "Älter";
}

/** Uhrzeit heute, Wochentag diese Woche, sonst Datum */
export function listTime(value: string) {
  const date = new Date(value);
  const label = groupLabel(value);
  if (label === "Heute") return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (label === "Gestern" || label === "Diese Woche") {
    return date.toLocaleDateString("de-DE", { weekday: "short" }) + " " + date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const fullTime = (value: string) =>
  new Date(value).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const recipientName = (r?: Recipient) => r?.emailAddress.name || r?.emailAddress.address || "Unbekannt";

export const recipientList = (list: Recipient[]) => list.map(recipientName).join("; ");

/** Absender in der Liste; bei Gesendet/Entwürfen die Empfänger*innen */
export function listName(message: Message, outgoing: boolean) {
  if (outgoing) return message.toRecipients.length ? recipientList(message.toRecipients) : "(Keine Empfänger*innen)";
  return recipientName(message.from);
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

/** Komma- oder Semikolon-getrennte Adressen */
export const parseAddresses = (value: string) =>
  value
    .split(/[;,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
