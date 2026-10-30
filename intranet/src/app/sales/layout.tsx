import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { SalesShell } from "@/components/sales/shell";

export const metadata: Metadata = { title: "Sales" };

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth area="sales">
      <SalesShell>{children}</SalesShell>
    </RequireAuth>
  );
}
