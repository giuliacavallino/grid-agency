import {
  CalendarDays,
  ListChecks,
  Mail,
  Receipt,
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
  { id: "sales", title: "Sales", text: "Pipeline, Kund*innen, Auftragsbuch, hello@ und giulia@", icon: TrendingUp, href: "/sales" },
  { id: "finance", title: "Finance", text: "Eingangsrechnungen, Freigabe, DATEV und buchhaltung@", icon: Receipt, href: "/finance" },
  { id: "personal", title: "Personal", text: "Bewerbungen von der ersten Mail bis zur Zusage", icon: Users, href: "/personal" },
  { id: "marketing", title: "Marketing", text: "Eigene Kanäle, Content und Kampagnen", icon: Megaphone, href: "/marketing" },
  { id: "mail", title: "Mail", text: "Alle Postfächer und Kalender an einem Ort", icon: Mail, href: "/mail" },
  { id: "kalender", title: "Kalender", text: "Termine und Meetings in Outlook", icon: CalendarDays, href: "https://outlook.office.com/calendar/", external: true },
  { id: "aufgaben", title: "Aufgaben", text: "To-dos und Zuständigkeiten", icon: ListChecks, href: "/aufgaben" },
  { id: "admin", title: "Admin", text: "Zugänge, Rechte und Einstellungen", icon: ShieldCheck, href: "/admin" },
];
