import type { Metadata } from "next";
import { Overview } from "@/components/aufgaben/overview";

export const metadata: Metadata = { title: "Archiv" };

export default function ArchivPage() {
  return <Overview archived />;
}
