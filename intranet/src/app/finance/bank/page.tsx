import { Suspense } from "react";
import type { Metadata } from "next";
import { Bank } from "@/components/finance/bank";

export const metadata: Metadata = { title: "Bank" };

export default function FinanceBankPage() {
  // useSearchParams (Rückkehr von der Bank) braucht eine Suspense-Grenze
  return (
    <Suspense>
      <Bank />
    </Suspense>
  );
}
