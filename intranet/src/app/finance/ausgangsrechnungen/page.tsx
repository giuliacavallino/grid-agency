import { Suspense } from "react";
import type { Metadata } from "next";
import { Billing } from "@/components/finance/billing";

export const metadata: Metadata = { title: "Rechnungen" };

export default function AusgangsrechnungenPage() {
  // useSearchParams (?id=) braucht beim Vorrendern eine Suspense-Grenze
  return (
    <Suspense>
      <Billing />
    </Suspense>
  );
}
