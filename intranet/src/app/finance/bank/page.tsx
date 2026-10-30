import { Suspense } from "react";
import type { Metadata } from "next";
import { Bank } from "@/components/finance/bank";
import { RequireAuth } from "@/components/login";

export const metadata: Metadata = { title: "Bank" };

export default function FinanceBankPage() {
  // Nur Geschäftsführung (Admin). useSearchParams (Rückkehr von der Bank)
  // braucht eine Suspense-Grenze.
  return (
    <RequireAuth area="admin">
      <Suspense>
        <Bank />
      </Suspense>
    </RequireAuth>
  );
}
