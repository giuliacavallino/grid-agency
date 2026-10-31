import type { Metadata } from "next";
import { Community } from "@/components/marketing/community";

export const metadata: Metadata = { title: "Community" };

export default function Page() {
  return <Community />;
}
