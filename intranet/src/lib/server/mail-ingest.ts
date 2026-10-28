import "server-only";
import { classifyMail } from "./classify";
import { db } from "./db";
import type { GraphMail } from "./graph-app";

/** Verarbeitet eine Mail an hello@ genau einmal: einordnen, protokollieren
 * und bei einer Kundenanfrage als Kachel in „Neuer Lead“ anlegen. */
export async function ingestMail(mail: GraphMail) {
  const store = db();
  const key = mail.internetMessageId || mail.id;
  if (await store.get("inbound_messages", key)) return "bekannt";

  const fromEmail = mail.from?.emailAddress.address ?? "";
  const fromName = mail.from?.emailAddress.name ?? fromEmail;
  const body = (mail.body?.content ?? mail.bodyPreview ?? "").trim();
  const result = await classifyMail({ fromName, fromEmail, subject: mail.subject ?? "", body });

  const logged = await store.insertIgnore("inbound_messages", {
    id: key,
    received_at: mail.receivedDateTime,
    from_email: fromEmail,
    from_name: fromName,
    subject: mail.subject,
    classification: result.classification,
    reason: result.reason,
  });
  // Parallel eingetroffene Benachrichtigung hat die Mail schon übernommen
  if (!logged || result.classification !== "anfrage") return result.classification;

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
    raw: { graph_id: mail.id, conversation_id: mail.conversationId, reason: result.reason },
  });
  if (lead) await store.update("inbound_messages", key, { lead_id: lead.id });
  return result.classification;
}
