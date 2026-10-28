import "server-only";
import { CLIENT_ID, SHARED_MAILBOX, TENANT_ID } from "@/lib/config";

// App-Zugriff (ohne angemeldete Person) auf hello@ für den Mail-Eingang.
// Braucht in Entra ein Client-Secret (MS_CLIENT_SECRET) und die
// Anwendungsberechtigung Mail.Read mit Admin-Zustimmung – am besten per
// Application Access Policy auf hello@ beschränkt.

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

export const MAILBOX_PATH = `/users/${encodeURIComponent(SHARED_MAILBOX)}`;

export type GraphMail = {
  id: string;
  internetMessageId: string;
  receivedDateTime: string;
  subject: string | null;
  from?: { emailAddress: { name?: string; address?: string } };
  body?: { content: string };
  bodyPreview?: string;
  conversationId?: string;
};

const SELECT = "id,internetMessageId,receivedDateTime,subject,from,body,bodyPreview,conversationId";

export const getMail = (id: string) =>
  appGraph<GraphMail>(`${MAILBOX_PATH}/messages/${encodeURIComponent(id)}?$select=${SELECT}`);

/** Mails im Posteingang seit einem Zeitpunkt (für den täglichen Abgleich). */
export async function listInboxSince(since: Date) {
  const filter = encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`);
  let next: string | null = `${MAILBOX_PATH}/mailFolders/inbox/messages?$select=${SELECT}&$filter=${filter}&$top=50`;
  const mails: GraphMail[] = [];
  while (next) {
    const page: { value: GraphMail[]; "@odata.nextLink"?: string } = await appGraph(next);
    mails.push(...page.value);
    next = page["@odata.nextLink"]?.replace("https://graph.microsoft.com/v1.0", "") ?? null;
  }
  return mails;
}
