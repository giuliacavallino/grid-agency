import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { AufgabenShell } from "@/components/aufgaben/shell";

export const metadata: Metadata = { title: "Aufgaben" };

export default function AufgabenLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AufgabenShell>{children}</AufgabenShell>
    </RequireAuth>
  );
}
