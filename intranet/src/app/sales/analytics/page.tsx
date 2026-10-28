import type { Metadata } from "next";
import { Analytics } from "@/components/sales/analytics";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return <Analytics />;
}
