import type { Metadata } from "next";
import { Applications } from "@/components/personal/applications";

export const metadata: Metadata = { title: "Bewerbungen" };

export default function PersonalPage() {
  return <Applications />;
}
