import type { Metadata } from "next";
import { Invoices } from "@/components/finance/invoices";

export const metadata: Metadata = { title: "Eingangsrechnungen" };

export default function FinancePage() {
  return <Invoices />;
}
