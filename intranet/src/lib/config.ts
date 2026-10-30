// Microsoft Entra ID: App-Registrierung "GRID Intranet" (Single-page
// application, Einzelmandant). Client- und Tenant-ID sind nicht geheim.
// Jede Seiten-URL (Produktion, Vercel-Preview, localhost) muss in Entra als
// SPA-Redirect-URI mit Slash am Ende eingetragen sein, sonst AADSTS50011.
export const CLIENT_ID = "bfd6b866-b603-42e0-8c33-74fde6f14239";
export const TENANT_ID = "ffbd83b1-951c-4041-aab7-a836e49e3957";
export const DOMAIN = "grid-agency.de";

/** Allgemeines Postfach (Hilfe beim Login, Absender von Sales). */
export const SHARED_MAILBOX = `hello@${DOMAIN}`;

export type MailboxArea = "sales" | "finance" | "mail";

export type MailboxInfo = {
  address: string;
  label: string;
  /** Bereiche des Hubs, in denen Posteingang (und Kalender) erscheinen */
  areas: MailboxArea[];
};

/** Postfächer, die das Intranet ausliest (Mail-Eingang: Anfrage → Lead,
 * Bewerbung → Personal, Rechnung → Finance) und in den Bereichen zeigt.
 * Die Mail-Kachel zeigt alle. */
export const MAILBOXES: MailboxInfo[] = [
  { address: `hello@${DOMAIN}`, label: "hello@", areas: ["sales", "mail"] },
  { address: `giulia.cavallino@${DOMAIN}`, label: "giulia@", areas: ["sales", "mail"] },
  { address: `buchhaltung@${DOMAIN}`, label: "buchhaltung@", areas: ["finance", "mail"] },
  { address: `google@${DOMAIN}`, label: "google@", areas: ["mail"] },
];

export const mailboxesFor = (area: MailboxArea) => MAILBOXES.filter((m) => m.areas.includes(area)).map((m) => m.address);

export const mailboxLabel = (address: string) =>
  MAILBOXES.find((m) => m.address === address.toLowerCase())?.label ?? address;

/** Postfach, über das Eingangsrechnungen an DATEV gehen */
export const FINANCE_MAILBOX = `buchhaltung@${DOMAIN}`;

/** Delegierte Graph-Rechte für die Postfächer. Die Person braucht in Exchange
 * Vollzugriff (und „Senden als“) auf jedes geteilte Postfach. */
export const MAIL_SCOPES = ["Mail.ReadWrite.Shared", "Mail.Send.Shared"];
export const CALENDAR_SCOPES = ["Calendars.ReadWrite.Shared"];

/** Lokale Vorschau ohne Microsoft-Login und ohne Datenbank: nur mit
 * NEXT_PUBLIC_INTRANET_DEMO=1 und nie im Produktions-Build. */
export const DEMO =
  process.env.NEXT_PUBLIC_INTRANET_DEMO === "1" && process.env.NODE_ENV !== "production";

/** Geschäftsführung: sieht im Tresor auch die internen GRID-Passwörter
 * und das Zugriffsprotokoll. */
export const MANAGEMENT = [`giulia.cavallino@${DOMAIN}`, ...(DEMO ? [`vorschau@${DOMAIN}`] : [])];
export const isManagement = (email: string) => MANAGEMENT.includes(email.toLowerCase());
