import type { OpenItem } from "@/lib/bank";
import { withUser } from "@/lib/server/auth";
import { easybillConfigured, openPayables } from "@/lib/server/bank";
import { openInvoices } from "@/lib/server/easybill";

export const maxDuration = 60;

/** Offene Rechnungen zum Zuordnen: Eingangsrechnungen und, falls easybill
 * eingerichtet ist, offene Ausgangsrechnungen. */
export const GET = withUser(async () => {
  let receivables: OpenItem[] = [];
  let easybillError: string | null = null;
  if (easybillConfigured()) {
    try {
      receivables = await openInvoices();
    } catch (error) {
      console.error(error);
      easybillError = error instanceof Error ? error.message : "easybill nicht erreichbar";
    }
  }
  return Response.json({ items: [...(await openPayables()), ...receivables], easybillError });
}, ["finance"]);
