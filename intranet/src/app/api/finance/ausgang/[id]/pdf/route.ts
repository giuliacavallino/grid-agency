import { withUser } from "@/lib/server/auth";
import { billingPdfUrl, getBilling } from "@/lib/server/billing";
import { BillingError, mailDraft, pdfAttachment, reminderDraft, renderPdf } from "@/lib/server/billing-write";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** PDF eines Belegs: abgelegt als 10 Minuten gültiger Link ({ url }), Entwürfe
 * als Vorschau ({ data } base64). ?mail=1 liefert Anhang, Betreff und Text,
 * ?mail=erinnerung dasselbe für eine Zahlungserinnerung. */
export const GET = withUser(async (_user, request, { params }: Context) => {
  const { id } = await params;
  try {
    const mail = new URL(request.url).searchParams.get("mail");
    if (mail === "erinnerung") {
      // Zahlungserinnerung: Text aus der Vorlage, Rechnung als PDF im Anhang
      const attachment = await pdfAttachment(id);
      const draft = await reminderDraft(attachment.doc);
      return Response.json({ ...draft, attachment: { name: attachment.name, contentType: attachment.contentType, contentBytes: attachment.contentBytes } });
    }
    if (mail) {
      const attachment = await pdfAttachment(id);
      const { subject, body } = await mailDraft(attachment.doc);
      return Response.json({
        to: attachment.doc.recipient_email,
        subject,
        body,
        attachment: { name: attachment.name, contentType: attachment.contentType, contentBytes: attachment.contentBytes },
      });
    }
    const url = await billingPdfUrl(id);
    if (url) return Response.json({ url });
    const doc = await getBilling(id);
    if (!doc) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    if (doc.source === "easybill") return Response.json({ error: "Kein PDF vorhanden" }, { status: 404 });
    return Response.json({ data: (await renderPdf(doc)).toString("base64") });
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}, ["finance"]);
