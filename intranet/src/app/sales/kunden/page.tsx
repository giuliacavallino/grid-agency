import { Suspense } from "react";
import type { Metadata } from "next";
import { Customers } from "@/components/sales/customers";

export const metadata: Metadata = { title: "Kunden" };

export default function CustomersPage() {
  // useSearchParams (?id=) braucht beim Vorrendern eine Suspense-Grenze
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}
