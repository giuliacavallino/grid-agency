import type { Metadata } from "next";
import { Analytics } from "@/components/sales/analytics";

export const metadata: Metadata = { title: "Auswertung" };

export default function AnalyticsPage() {
  return <Analytics />;
}
