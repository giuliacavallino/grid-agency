import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { MailShell } from "@/components/sales/shell";

export const metadata: Metadata = { title: "Mail" };

export default function MailLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth area="mail">
      <MailShell>{children}</MailShell>
    </RequireAuth>
  );
}
