import type { Metadata } from "next";
import { CalendarApp } from "@/components/sales/calendar/calendar";

export const metadata: Metadata = { title: "Kalender" };

export default function KalenderPage() {
  return <CalendarApp />;
}
