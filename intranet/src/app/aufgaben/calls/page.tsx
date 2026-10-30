import type { Metadata } from "next";
import { CallResults } from "@/components/aufgaben/calls";

export const metadata: Metadata = { title: "Aus Calls" };

export default function CallsPage() {
  return <CallResults />;
}
