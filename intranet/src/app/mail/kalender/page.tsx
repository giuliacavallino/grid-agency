import type { Metadata } from "next";
import { CalendarApp } from "@/components/sales/calendar/calendar";
import { mailboxesFor } from "@/lib/config";

export const metadata: Metadata = { title: "Kalender" };

export default function MailKalenderPage() {
  return <CalendarApp mailboxes={mailboxesFor("mail")} />;
}
