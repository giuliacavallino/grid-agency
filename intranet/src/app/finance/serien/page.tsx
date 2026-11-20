import { Suspense } from "react";
import type { Metadata } from "next";
import { Billing } from "@/components/finance/billing";

export const metadata: Metadata = { title: "Serien" };

export default function SerienPage() {
  // useSearchParams (?id=) braucht beim Vorrendern eine Suspense-Grenze
  return (
    <Suspense>
      <Billing view="serien" />
    </Suspense>
  );
}
