"use client";

import { Bot, CalendarDays, Globe, Link2 } from "lucide-react";
import { AreaShell, type NavItem } from "@/components/sales/shell";
import { WorkspaceAccent } from "./workspace";

const NAV: NavItem[] = [
  { href: "/marketing", label: "Kundenwelten", icon: Globe },
  { href: "/marketing/posts", label: "Posts & Planung", icon: CalendarDays },
  { href: "/marketing/kanaele", label: "Kanäle", icon: Link2 },
  { href: "/marketing/agent", label: "Agent & API", icon: Bot },
];

/** Marketing Hub: je Kundenwelt Kanäle verbinden, Posts planen und veröffentlichen */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Marketing" nav={NAV}>
      <WorkspaceAccent />
      {children}
    </AreaShell>
  );
}
