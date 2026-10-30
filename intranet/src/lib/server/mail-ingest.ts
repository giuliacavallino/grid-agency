import "server-only";
import { PREPAID_METHODS } from "@/lib/sales/types";
import { getBeleg } from "./beleg";
import { classifyMail } from "./classify";
import { db } from "./db";
import { attachmentNames, moveToInvoiceFolder, type GraphMail } from "./graph-app";

const isoDate = (value: string | null | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
const money = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Rechnungsmail in den Ordner „Eingangsrechnungen“ des Postfachs verschieben.
 * Fehler (z. B. fehlende Berechtigung) halten den Eingang nicht auf. */
async function fileInvoiceMail(mailbox: string, id: string) {
  try {
    return await moveToInvoiceFolder(mailbox, id);
  } catch (error) {
    console.error(`Rechnungsmail in ${mailbox} nicht verschoben:`, error);
    return null;
  }
}

/** Verarbeitet eine eingegangene Mail genau einmal: einordnen, protokollieren
 * und an die richtige Stelle im Hub legen – Anfrage → Kachel in „Neuer Lead“
 * (Sales), Bewerbung → „Neue Bewerbung“ (Personal), Rechnung → „Neu“
 * (Finance). Dieselbe Mail in mehreren Postfächern zählt nur einmal. */
export async function ingestMail(mail: GraphMail) {
  const store = db();
  const key = mail.internetMessageId || mail.id;
  const known = await store.get("inbound_messages", key);
  if (known) {
    // Dieselbe Rechnung auch in einem anderen Postfach: dort ebenfalls wegräumen
    if (known.classification === "rechnung" && known.mailbox !== mail.mailbox) await fileInvoiceMail(mail.mailbox, mail.id);
    return "bekannt";
  }

  const fromEmail = mail.from?.emailAddress.address ?? "";
  const fromName = mail.from?.emailAddress.name ?? fromEmail;
  const body = (mail.body?.content ?? mail.bodyPreview ?? "").trim();
  const attachments = await attachmentNames(mail).catch(() => []);
  const result = await classifyMail({ mailbox: mail.mailbox, fromName, fromEmail, subject: mail.subject ?? "", body, attachments });

  const logged = await store.insertIgnore("inbound_messages", {
    id: key,
    mailbox: mail.mailbox,
    graph_id: mail.id,
    received_at: mail.receivedDateTime,
    from_email: fromEmail,
    from_name: fromName,
    subject: mail.subject,
    classification: result.classification,
    reason: result.reason,
  });
  // Parallel eingetroffene Benachrichtigung hat die Mail schon übernommen
  if (!logged) return result.classification;

  const origin = { source_ref: key, mailbox: mail.mailbox, graph_id: mail.id, received_at: mail.receivedDateTime };
  const raw = { conversation_id: mail.conversationId, reason: result.reason };

  if (result.classification === "anfrage") {
    const lead = await store.insertIgnore("leads", {
      source: "email",
      source_ref: key,
      stage: "neu",
      name: result.contact_name || fromName || fromEmail,
      email: fromEmail || null,
      company: result.company,
      phone: result.phone,
      message: [mail.subject, body].filter(Boolean).join("\n\n"),
      created_at: mail.receivedDateTime,
      raw: { ...raw, graph_id: mail.id, mailbox: mail.mailbox },
    });
    if (lead) await store.update("inbound_messages", key, { lead_id: lead.id });
  }

  if (result.classification === "bewerbung") {
    const application = await store.insertIgnore("applications", {
      ...origin,
      stage: "neu",
      name: result.contact_name || fromName || fromEmail,
      email: fromEmail || null,
      phone: result.phone,
      position_title: result.position_title,
      message: [mail.subject, body].filter(Boolean).join("\n\n").slice(0, 8000),
      attachment_names: attachments,
      raw,
    });
    if (application) await store.update("inbound_messages", key, { application_id: application.id });
  }

  if (result.classification === "rechnung") {
    const invoice = result.invoice;
    const method = invoice?.payment_method ?? null;
    const row = await store.insertIgnore("invoices", {
      ...origin,
      stage: "neu",
      vendor: invoice?.vendor || result.company || fromName || fromEmail || "Unbekannt",
      vendor_email: fromEmail || null,
      invoice_number: invoice?.invoice_number ?? null,
      invoice_date: isoDate(invoice?.invoice_date),
      due_date: isoDate(invoice?.due_date),
      amount: money(invoice?.amount),
      net_amount: money(invoice?.net_amount),
      vat_amount: money(invoice?.vat_amount),
      currency: invoice?.currency || "EUR",
      payment_method: method,
      category: invoice?.category ?? null,
      // Karte, PayPal, Lastschrift: meist schon abgebucht
      paid: !!method && PREPAID_METHODS.includes(method),
      description: invoice?.description ?? mail.subject,
      attachment_names: attachments,
      raw,
    });
    if (row) {
      const movedId = await fileInvoiceMail(mail.mailbox, mail.id);
      if (movedId) await store.update("invoices", row.id, { graph_id: movedId });
      await store.update("inbound_messages", key, { invoice_id: row.id, ...(movedId && { graph_id: movedId }) });
      // Beleg gleich ablegen, damit die Vorschau in der Freigabe sofort da ist
      await getBeleg({ ...row, graph_id: movedId ?? row.graph_id }).catch((error) =>
        console.error("Beleg nicht abgelegt:", error)
      );
    }
  }

  return result.classification;
}
