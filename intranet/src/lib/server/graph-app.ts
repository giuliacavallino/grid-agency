import "server-only";
import { CLIENT_ID, TENANT_ID } from "@/lib/config";

// App-Zugriff (ohne angemeldete Person) auf die Postfächer aus MAILBOXES für
// den Mail-Eingang. Braucht in Entra ein Client-Secret (MS_CLIENT_SECRET) und
// die Anwendungsberechtigung Mail.ReadWrite mit Admin-Zustimmung (ReadWrite,
// weil erkannte Rechnungen in „Eingangsrechnungen“ verschoben werden) – am
// besten per Application Access Policy auf diese Postfächer beschränkt.

let cached: { token: string; expires: number } | null = null;

async function appToken() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const secret = process.env.MS_CLIENT_SECRET;
  if (!secret) throw new Error("MS_CLIENT_SECRET fehlt");
  const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Token-Abruf fehlgeschlagen: ${data.error_description ?? response.status}`);
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export async function appGraph<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await appToken()}`,
      "Content-Type": "application/json",
      // Mailtext als Klartext, das reicht für Einordnung und Lead
      Prefer: 'outlook.body-content-type="text"',
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Graph ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? (undefined as T) : response.json();
}

export const mailboxPath = (mailbox: string) => `/users/${encodeURIComponent(mailbox)}`;

export type GraphMail = {
  id: string;
  /** Postfach, in dem die Mail liegt */
  mailbox: string;
  internetMessageId: string;
  receivedDateTime: string;
  subject: string | null;
  from?: { emailAddress: { name?: string; address?: string } };
  body?: { content: string };
  bodyPreview?: string;
  conversationId?: string;
  hasAttachments?: boolean;
};

const SELECT = "id,internetMessageId,receivedDateTime,subject,from,body,bodyPreview,conversationId,hasAttachments";

export const getMail = async (mailbox: string, id: string): Promise<GraphMail> => ({
  ...(await appGraph<Omit<GraphMail, "mailbox">>(`${mailboxPath(mailbox)}/messages/${encodeURIComponent(id)}?$select=${SELECT}`)),
  mailbox,
});

/** Namen der Dateianhänge (ohne eingebettete Bilder) */
export async function attachmentNames(mail: GraphMail) {
  if (!mail.hasAttachments) return [];
  const data = await appGraph<{ value: { name: string; isInline: boolean }[] }>(
    `${mailboxPath(mail.mailbox)}/messages/${encodeURIComponent(mail.id)}/attachments?$select=name,isInline`
  );
  return data.value.filter((a) => !a.isInline).map((a) => a.name);
}

/** Ordner für erfasste Rechnungen, je Postfach auf oberster Ebene */
export const INVOICE_FOLDER = "Eingangsrechnungen";
const invoiceFolders = new Map<string, string>();

async function invoiceFolder(mailbox: string) {
  const known = invoiceFolders.get(mailbox);
  if (known) return known;
  const find = async () => {
    const filter = encodeURIComponent(`displayName eq '${INVOICE_FOLDER}'`);
    const data = await appGraph<{ value: { id: string }[] }>(`${mailboxPath(mailbox)}/mailFolders?$filter=${filter}&$select=id`);
    return data.value[0]?.id ?? null;
  };
  let id = await find();
  if (!id) {
    try {
      const created = await appGraph<{ id: string }>(`${mailboxPath(mailbox)}/mailFolders`, {
        method: "POST",
        body: JSON.stringify({ displayName: INVOICE_FOLDER }),
      });
      id = created.id;
    } catch (error) {
      // Parallel angelegt (ErrorFolderExists) → nochmal suchen
      id = await find();
      if (!id) throw error;
    }
  }
  invoiceFolders.set(mailbox, id);
  return id;
}

/** Verschiebt eine Rechnungsmail nach „Eingangsrechnungen“, damit sie im
 * Posteingang niemand ein zweites Mal bearbeitet. Liefert die neue Mail-ID
 * (Graph vergibt beim Verschieben eine neue). */
export async function moveToInvoiceFolder(mailbox: string, id: string) {
  const destinationId = await invoiceFolder(mailbox);
  const moved = await appGraph<{ id: string }>(`${mailboxPath(mailbox)}/messages/${encodeURIComponent(id)}/move`, {
    method: "POST",
    body: JSON.stringify({ destinationId }),
  });
  return moved.id;
}

/** Mails im Posteingang seit einem Zeitpunkt (für den täglichen Abgleich). */
export async function listInboxSince(mailbox: string, since: Date) {
  const filter = encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`);
  let next: string | null = `${mailboxPath(mailbox)}/mailFolders/inbox/messages?$select=${SELECT}&$filter=${filter}&$top=50`;
  const mails: GraphMail[] = [];
  while (next) {
    const page: { value: Omit<GraphMail, "mailbox">[]; "@odata.nextLink"?: string } = await appGraph(next);
    mails.push(...page.value.map((mail) => ({ ...mail, mailbox })));
    next = page["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null;
  }
  return mails;
}
