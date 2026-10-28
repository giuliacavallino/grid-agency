import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { PersonalShell } from "@/components/sales/shell";

export const metadata: Metadata = { title: "Personal" };

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <PersonalShell>{children}</PersonalShell>
    </RequireAuth>
  );
}
