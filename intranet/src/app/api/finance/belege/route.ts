import { withUser } from "@/lib/server/auth";
import { getBilling, listBilling } from "@/lib/server/billing";
import { BillingError, saveDraft } from "@/lib/server/billing-write";

/** Alle Ausgangsbelege (Rechnungen, Stornos, Angebote, Serien …) für die Liste */
export const GET = withUser(async () => Response.json(await listBilling()));

/** Neuer Entwurf (Rechnung, Gutschrift) oder neue Serie */
export const POST = withUser(async (_user, request) => {
  try {
    const id = await saveDraft(null, await request.json());
    return Response.json(await getBilling(id), { status: 201 });
  } catch (error) {
    if (error instanceof BillingError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
});
