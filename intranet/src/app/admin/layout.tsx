import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = { title: "Admin" };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}
