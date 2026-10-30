"use client";

import { History, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isManagement } from "@/lib/config";
import { AreaShell, type NavItem } from "@/components/sales/shell";

/** Admin: Passwörter für alle, Zugriffsprotokoll nur für die Geschäftsführung. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const nav: NavItem[] = [{ href: "/admin", label: "Passwörter", icon: KeyRound }];
  if (auth.status === "signed-in" && isManagement(auth.account.email)) nav.push({ href: "/admin/protokoll", label: "Protokoll", icon: History });
  return (
    <AreaShell title="Admin" nav={nav}>
      {children}
    </AreaShell>
  );
}
