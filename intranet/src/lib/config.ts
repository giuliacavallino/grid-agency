// Microsoft Entra ID: App-Registrierung "GRID Intranet" (Single-page
// application, Einzelmandant). Client- und Tenant-ID sind nicht geheim.
// Jede Seiten-URL (Produktion, Vercel-Preview, localhost) muss in Entra als
// SPA-Redirect-URI mit Slash am Ende eingetragen sein, sonst AADSTS50011.
export const CLIENT_ID = "bfd6b866-b603-42e0-8c33-74fde6f14239";
export const TENANT_ID = "ffbd83b1-951c-4041-aab7-a836e49e3957";
export const DOMAIN = "grid-agency.de";

/** Gemeinsames Postfach, das Posteingang und Kalender im Sales spiegeln. */
export const SHARED_MAILBOX = `hello@${DOMAIN}`;

/** Delegierte Graph-Rechte für hello@. Die Person braucht in Exchange
 * Vollzugriff (und „Senden als“) auf das Postfach. */
export const MAIL_SCOPES = ["Mail.ReadWrite.Shared", "Mail.Send.Shared"];
export const CALENDAR_SCOPES = ["Calendars.ReadWrite.Shared"];

/** Lokale Vorschau ohne Microsoft-Login und ohne Datenbank: nur mit
 * NEXT_PUBLIC_INTRANET_DEMO=1 und nie im Produktions-Build. */
export const DEMO =
  process.env.NEXT_PUBLIC_INTRANET_DEMO === "1" && process.env.NODE_ENV !== "production";
