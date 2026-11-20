import type { Metadata } from "next";
import { FinanceCustomers } from "@/components/finance/customers";
import { RequireAuth } from "@/components/login";

export const metadata: Metadata = { title: "Kunden" };

export default function FinanceKundenPage() {
  // Kundendaten liegen in Sales; ohne Sales-Recht gibt es sie nicht
  return (
    <RequireAuth area="sales">
      <FinanceCustomers />
    </RequireAuth>
  );
}
