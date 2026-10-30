import { withUser } from "@/lib/server/auth";
import { getBilling } from "@/lib/server/billing";
import { setSeriesStatus, takeOverSeries } from "@/lib/server/billing-series";
import { BillingError, addPayment, cancel, correct, credit, ensurePdf, finalize, markSent, removePayment } from "@/lib/server/billing-write";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** Aktionen an einem Beleg. Antwort: der (neue) Beleg, den die Oberfläche öffnet. */
export const POST = withUser(async (_user, request, { params }: Context) => {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  let open = id;
  try {
    switch (body.action) {
      case "festschreiben":
        await finalize(id);
        break;
      case "pdf_nachholen":
        await ensurePdf(id);
        break;
      case "stornieren":
        open = await cancel(id);
        break;
      case "korrigieren":
        open = (await correct(id)).draft;
        break;
      case "gutschrift":
        open = await credit(id);
        break;
      case "zahlung":
        await addPayment(id, body as never);
        break;
      case "zahlung_loeschen":
        await removePayment(id, String(body.payment_id));
        break;
      case "versendet":
        await markSent(id, String(body.to ?? "").slice(0, 500));
        break;
      case "uebernehmen":
        await takeOverSeries(id);
        break;
      case "pausieren":
        await setSeriesStatus(id, "PAUSE");
        break;
      case "fortsetzen":
        await setSeriesStatus(id, "RUNNING");
        break;
      case "beenden":
        await setSeriesStatus(id, "STOP");
        break;
      default:
        return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
  return Response.json(await getBilling(open));
}, ["finance"]);
