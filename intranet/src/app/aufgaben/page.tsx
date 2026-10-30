import type { Metadata } from "next";
import { Overview } from "@/components/aufgaben/overview";

export const metadata: Metadata = { title: "Alle Kunden" };

export default function AufgabenPage() {
  return <Overview />;
}
