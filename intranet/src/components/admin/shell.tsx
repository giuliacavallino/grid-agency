"use client";

import { Building2, History, KeyRound, Send, Users } from "lucide-react";
import { AreaShell, type NavItem } from "@/components/sales/shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Passwörter", icon: KeyRound },
  { href: "/admin/benutzer", label: "Benutzer & Rechte", icon: Users },
  { href: "/admin/firma", label: "Firmendaten", icon: Building2 },
  { href: "/admin/absender", label: "Absender & Updates", icon: Send },
  { href: "/admin/protokoll", label: "Protokoll", icon: History },
];

/** Admin-Konsole (nur Rolle admin): Passwörter, Benutzer und Rechte,
 * Firmendaten, automatische Kunden-Updates, Zugriffsprotokoll. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Admin" nav={NAV}>
      {children}
    </AreaShell>
  );
}
