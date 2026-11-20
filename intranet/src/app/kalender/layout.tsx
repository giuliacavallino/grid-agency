import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { KalenderShell } from "@/components/sales/shell";

export const metadata: Metadata = { title: "Kalender" };

export default function KalenderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth area="kalender">
      <KalenderShell>{children}</KalenderShell>
    </RequireAuth>
  );
}
