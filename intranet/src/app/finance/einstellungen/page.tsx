import type { Metadata } from "next";
import { FinanceSettings } from "@/components/finance/settings";

export const metadata: Metadata = { title: "Finance-Einstellungen" };

export default function FinanceSettingsPage() {
  return <FinanceSettings />;
}
