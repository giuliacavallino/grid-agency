import {
  CalendarDays,
  ListChecks,
  Mail,
  Megaphone,
  ShieldCheck,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type Area = {
  id: string;
  title: string;
  text: string;
  icon: LucideIcon;
  href: string;
  /** Öffnet eine externe App (Microsoft 365) in einem neuen Tab */
  external?: boolean;
};

// Bereiche des Hubs: Navbar, Mobile-Menü und Kacheln entstehen aus dieser Liste.
export const AREAS: Area[] = [
  { id: "sales", title: "Sales", text: "Pipeline, Kund*innen, Auftragsbuch und hello@", icon: TrendingUp, href: "/sales" },
  { id: "personal", title: "Personal", text: "Team, Urlaub und Onboarding", icon: Users, href: "/personal" },
  { id: "marketing", title: "Marketing", text: "Eigene Kanäle, Content und Kampagnen", icon: Megaphone, href: "/marketing" },
  { id: "mail", title: "Mail", text: "Dein Outlook-Postfach", icon: Mail, href: "https://outlook.office.com/mail/", external: true },
  { id: "kalender", title: "Kalender", text: "Termine und Meetings in Outlook", icon: CalendarDays, href: "https://outlook.office.com/calendar/", external: true },
  { id: "aufgaben", title: "Aufgaben", text: "To-dos und Zuständigkeiten", icon: ListChecks, href: "/aufgaben" },
  { id: "admin", title: "Admin", text: "Zugänge, Rechte und Einstellungen", icon: ShieldCheck, href: "/admin" },
];
