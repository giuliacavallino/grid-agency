"use client";

import { Bot, CalendarDays, Globe, Link2, MessagesSquare, Palette, Send } from "lucide-react";
import { AreaShell, type NavItem } from "@/components/sales/shell";
import { WorkspaceAccent } from "./workspace";

const NAV: NavItem[] = [
  { href: "/marketing", label: "Kundenwelten", icon: Globe },
  { href: "/marketing/posts", label: "Posts & Planung", icon: CalendarDays },
  { href: "/marketing/community", label: "Community", icon: MessagesSquare },
  { href: "/marketing/outreach", label: "Outreach", icon: Send },
  { href: "/marketing/kanaele", label: "Kanäle", icon: Link2 },
  { href: "/marketing/ci", label: "CI & Vorgaben", icon: Palette },
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
