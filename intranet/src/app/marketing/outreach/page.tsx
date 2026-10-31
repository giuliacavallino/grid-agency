import type { Metadata } from "next";
import { OutreachPage } from "@/components/marketing/outreach";

export const metadata: Metadata = { title: "Outreach" };

export default function Page() {
  return <OutreachPage />;
}
