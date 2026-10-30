import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
const isXml = (f: { name: string; contentType: string }) => /xml/i.test(f.contentType) || /\.xml$/i.test(f.name);
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

/** Dateianhänge der Rechnungsmail (ohne eingebettete Bilder und Signaturen) */
async function attachmentFiles(invoice: Row): Promise<BelegFile[]> {
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

/** Belegdateien für DATEV. Steht der Beleg nur im Mailtext (z. B. Fahrt- oder
 * Shop-Quittungen ohne Anhang), wird daraus ein PDF erzeugt – DATEV legt nur
 * Anhänge als Beleg an. */
export async function belegFiles(invoice: Row): Promise<BelegFile[]> {
  const files = await attachmentFiles(invoice);
  if (!invoice.mailbox || !invoice.graph_id || files.some((f) => isPdf(f) || isImage(f) || isXml(f))) return files;
  return [...files, await mailPdf(invoice)];
}

// ---------- Mailtext als PDF ----------

type MailText = { subject?: string; receivedDateTime?: string; from?: { emailAddress?: { name?: string; address?: string } }; body?: { content: string } };

async function mailPdf(invoice: Row): Promise<BelegFile> {
  const id = await messageId(invoice);
  // appGraph liefert den Mailtext als Klartext
  const mail = await appGraph<MailText>(
    `${mailboxPath(invoice.mailbox as string)}/messages/${encodeURIComponent(id)}?$select=subject,from,receivedDateTime,body`
  );
  const sender = mail.from?.emailAddress;
  const received = mail.receivedDateTime ? new Date(mail.receivedDateTime).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "";
  const bytes = await textPdf(mail.subject || "Beleg", [
    `Von: ${[sender?.name, sender?.address && `<${sender.address}>`].filter(Boolean).join(" ")}`,
    `Empfangen: ${received}`,
    `Postfach: ${invoice.mailbox}`,
  ], mail.body?.content ?? "");
  const base = [invoice.vendor, invoice.invoice_number].filter(Boolean).join(" ") || "Beleg";
  return { name: `${String(base).replace(/[^\w.\- ]+/g, "_").trim()}.pdf`, contentType: "application/pdf", bytes };
}

/** Schlichtes A4-PDF: Betreff, Kopfzeilen, Mailtext mit Zeilenumbruch. */
async function textPdf(title: string, meta: string[], body: string) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Standardschrift kann nur WinAnsi: Emojis weglassen, sonstiges als „?“
  const known = new Set(font.getCharacterSet());
  const clean = (text: string) =>
    [...text.replace(/\t/g, "    ").replace(/[\u00a0\u202f]/g, " ")].map((c) => (known.has(c.codePointAt(0)!) ? c : c.codePointAt(0)! > 0xffff ? "" : "?")).join("");

  const [width, height, margin] = [595.28, 841.89, 56];
  let page = doc.addPage([width, height]);
  let y = height - margin;
  const write = (text: string, size: number, face = font, color = rgb(0.12, 0.11, 0.1)) => {
    const words = clean(text).split(/(\s+)/);
    let line = "";
    const flush = () => {
      if (y < margin + size) {
        page = doc.addPage([width, height]);
        y = height - margin;
      }
      page.drawText(line.trimEnd(), { x: margin, y: y - size, size, font: face, color });
      y -= size * 1.45;
      line = "";
    };
    for (const word of words) {
      if (face.widthOfTextAtSize(line + word, size) > width - 2 * margin && line.trim()) flush();
      // Überlange Wörter (URLs) hart umbrechen
      let rest = line ? word : word.trimStart();
      while (face.widthOfTextAtSize(line + rest, size) > width - 2 * margin && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && face.widthOfTextAtSize(line + rest.slice(0, cut), size) > width - 2 * margin) cut--;
        line += rest.slice(0, cut);
        flush();
        rest = rest.slice(cut);
      }
      line += rest;
    }
    flush();
  };

  write(title, 15, bold);
  y -= 4;
  for (const line of meta) write(line, 9, font, rgb(0.4, 0.38, 0.36));
  y -= 10;
  const text = body.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim()) write(paragraph, 10);
    else y -= 7;
  }
  return Buffer.from(await doc.save());
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

  const files = await attachmentFiles(invoice);
  let beleg: Beleg | undefined = files.find(isPdf) ?? files.find(isImage);
  if (beleg && isPdf(beleg)) beleg = { ...beleg, contentType: "application/pdf" };
  if (!beleg) beleg = { name: "Mail.html", contentType: "text/html; charset=utf-8", bytes: Buffer.from(await mailHtml(invoice), "utf8") };

  const path = `${invoice.id}/${beleg.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await sb().storage.from(BUCKET).upload(path, beleg.bytes, { contentType: beleg.contentType, upsert: true });
  if (error) console.error("Beleg nicht gespeichert:", error.message);
  else await db().update("invoices", invoice.id, { beleg_path: path, beleg_type: beleg.contentType, beleg_name: beleg.name });
  return beleg;
}
