import { withUser } from "@/lib/server/auth";
import { listBilling } from "@/lib/server/billing";

/** Alle Ausgangsbelege (Rechnungen, Stornos, Angebote, Serien …) für die Liste */
export const GET = withUser(async () => Response.json(await listBilling()));
