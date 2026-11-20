import type { Metadata } from "next";
import { Applications } from "@/components/personal/applications";

export const metadata: Metadata = { title: "Bewerber-Pipeline" };

export default function PersonalPage() {
  return <Applications />;
}
