import { CalendarApp } from "@/components/sales/calendar/calendar";
import { mailboxesFor } from "@/lib/config";

export default function KalenderPage() {
  return <CalendarApp mailboxes={mailboxesFor("mail")} />;
}
