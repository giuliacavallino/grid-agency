import "server-only";
import { appGraph, mailboxPath } from "./graph-app";
import { db, sb, type Row } from "./db";

// Beleg einer Eingangsrechnung: per App-Zugriff aus der Rechnungsmail holen
// (unabhängig davon, wer angemeldet ist und ob die Mail inzwischen verschoben
// wurde) und einmal in Storage ablegen. Danach kommt er immer von dort.

const BUCKET = "belege";

export type BelegFile = { name: string; contentType: string; bytes: Buffer };

const isPdf = (f: { name: string; contentType: string }) => /pdf/i.test(f.contentType) || /\.pdf$/i.test(f.name);
const isImage = (f: { name: string; contentType: string }) =>
  /^image\//i.test(f.contentType) || /\.(png|jpe?g|gif|webp)$/i.test(f.name);
const isSmime = (f: { name: string; contentType: string }) =>
  /pkcs7-mime|smime/i.test(f.contentType) || /\.p7m$/i.test(f.name);
const isSignature = (f: { name: string; contentType: string }) =>
  /pkcs7-signature/i.test(f.contentType) || /\.p7s$/i.test(f.name);

// ---------- Mail finden ----------

/** Gültige Mail-ID der Rechnung. Wurde die Mail verschoben (neue ID), über die
 * Internet-Message-ID im ganzen Postfach suchen und die ID nachtragen. */
async function messageId(invoice: Row): Promise<string> {
  const mailbox = invoice.mailbox as string;
  const id = invoice.graph_id as string;
  try {
    await appGraph(`${mailboxPath(mailbox)}/messages/${encodeURIComponent(id)}?$select=id`);
    return id;
  } catch (error) {
    const key = invoice.source_ref as string | null;
    if (!key || !key.includes("@")) throw error;
    const filter = encodeURIComponent(`internetMessageId eq '${key.replace(/'/g, "''")}'`);
    const found = await appGraph<{ value: { id: string }[] }>(`${mailboxPath(mailbox)}/messages?$filter=${filter}&$select=id&$top=1`);
    const current = found.value[0]?.id;
    if (!current) throw new Error("Die Rechnungsmail ist nicht mehr im Postfach");
    await db().update("invoices", invoice.id, { graph_id: current });
    await db().update("inbound_messages", key, { graph_id: current }).catch(() => {});
    return current;
  }
}

// ---------- S/MIME ----------

/** Dateien aus einer MIME-Nachricht (z. B. smime.p7m signierter Mails). */
function mimeFiles(raw: string): BelegFile[] {
  const split = raw.search(/\r?\n\r?\n/);
  if (split < 0) return [];
  const head = raw.slice(0, split).replace(/\r?\n[ \t]+/g, " ");
  const body = raw.slice(split).replace(/^\r?\n\r?\n/, "");
  const header = (name: string) => head.match(new RegExp(`^${name}:\\s*(.*)$`, "im"))?.[1] ?? "";
  const type = header("Content-Type");
  const boundary = type.match(/boundary="?([^";]+)"?/i)?.[1];
  if (boundary) {
    return body
      .split(`--${boundary}`)
      .slice(1)
      .filter((part) => !part.startsWith("--"))
      .flatMap((part) => mimeFiles(part.replace(/^\r?\n/, "")));
  }
  const name =
    header("Content-Disposition").match(/filename\*?="?([^";]+)"?/i)?.[1] ?? type.match(/name\*?="?([^";]+)"?/i)?.[1];
  if (!name || !/base64/i.test(header("Content-Transfer-Encoding"))) return [];
  const contentType = type.split(";")[0].trim() || "application/octet-stream";
  return [{ name: name.replace(/^utf-8''/i, ""), contentType, bytes: Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ""), "base64") }];
}

export function expandSmime(file: BelegFile): BelegFile[] {
  const text = file.bytes.toString("latin1");
  // Klar signiert: MIME-Text; undurchsichtig signiert: MIME steckt im PKCS#7-Container
  const start = text.search(/(MIME-Version|Content-Type):/i);
  if (start < 0) return [];
  return mimeFiles(text.slice(start)).flatMap((f) => (isSmime(f) ? expandSmime(f) : [f]));
}

// ---------- Dateien ----------

type GraphAttachment = { "@odata.type": string; name: string; contentType: string | null; contentBytes?: string; isInline: boolean };

/** Alle Belegdateien der Rechnungsmail (ohne eingebettete Bilder und Signaturen) */
export async function belegFiles(invoice: Row): Promise<BelegFile[]> {
  if (!invoice.mailbox || !invoice.graph_id) return [];
  const mailbox = invoice.mailbox as string;
  const id = await messageId(invoice);
  const data = await appGraph<{ value: GraphAttachment[] }>(`${mailboxPath(mailbox)}/messages/${encodeURIComponent(id)}/attachments`);
  return data.value
    .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment" && !a.isInline && a.contentBytes)
    .map((a) => ({ name: a.name, contentType: a.contentType ?? "application/octet-stream", bytes: Buffer.from(a.contentBytes!, "base64") }))
    .flatMap((f) => (isSmime(f) ? expandSmime(f) : [f]))
    .filter((f) => !isSignature(f));
}

async function mailHtml(invoice: Row) {
  const id = await messageId(invoice);
  const message = await appGraph<{ body?: { contentType: string; content: string } }>(
    `${mailboxPath(invoice.mailbox as string)}/messages/${encodeURIComponent(id)}?$select=body`,
    { headers: { Prefer: 'outlook.body-content-type="html"' } }
  );
  return message.body?.content ?? "";
}

// ---------- Vorschau ----------

export type Beleg = { name: string; contentType: string; bytes: Buffer };

/** Beleg für die Vorschau: PDF, sonst Bild, sonst der Mailtext (HTML). Wird
 * beim ersten Abruf in Storage abgelegt. */
export async function getBeleg(invoice: Row): Promise<Beleg | null> {
  if (invoice.beleg_path) {
    const { data, error } = await sb().storage.from(BUCKET).download(invoice.beleg_path as string);
    if (!error && data) {
      return { name: (invoice.beleg_name as string) ?? "Beleg", contentType: (invoice.beleg_type as string) ?? data.type, bytes: Buffer.from(await data.arrayBuffer()) };
    }
  }
  if (!invoice.mailbox || !invoice.graph_id) return null;

  const files = await belegFiles(invoice);
  let beleg: Beleg | undefined = files.find(isPdf) ?? files.find(isImage);
  if (beleg && isPdf(beleg)) beleg = { ...beleg, contentType: "application/pdf" };
  if (!beleg) beleg = { name: "Mail.html", contentType: "text/html; charset=utf-8", bytes: Buffer.from(await mailHtml(invoice), "utf8") };

  const path = `${invoice.id}/${beleg.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await sb().storage.from(BUCKET).upload(path, beleg.bytes, { contentType: beleg.contentType, upsert: true });
  if (error) console.error("Beleg nicht gespeichert:", error.message);
  else await db().update("invoices", invoice.id, { beleg_path: path, beleg_type: beleg.contentType, beleg_name: beleg.name });
  return beleg;
}
