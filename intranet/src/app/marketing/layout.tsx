import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = { title: "Marketing" };

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth area="marketing">
      <MarketingShell>{children}</MarketingShell>
    </RequireAuth>
  );
}
