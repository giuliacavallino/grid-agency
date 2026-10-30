import type { OpenItem } from "@/lib/bank";
import { withUser } from "@/lib/server/auth";
import { openPayables } from "@/lib/server/bank";
import { openReceivables } from "@/lib/server/receivables";

/** Offene Rechnungen zum Zuordnen: Eingangsrechnungen und Ausgangsrechnungen */
export const GET = withUser(async () => {
  let receivables: OpenItem[] = [];
  let receivablesError: string | null = null;
  try {
    receivables = await openReceivables();
  } catch (error) {
    console.error(error);
    receivablesError = error instanceof Error ? error.message : "Ausgangsrechnungen nicht lesbar";
  }
  return Response.json({ items: [...(await openPayables()), ...receivables], receivablesError });
}, ["finance"]);
