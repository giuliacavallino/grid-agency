import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { FinanceShell } from "@/components/sales/shell";

export const metadata: Metadata = { title: "Finance" };

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <FinanceShell>{children}</FinanceShell>
    </RequireAuth>
  );
}
