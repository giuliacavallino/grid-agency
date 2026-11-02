import type { Metadata } from "next";
import { Ideas } from "@/components/akte/ideas";

export const metadata: Metadata = { title: "Vorschläge" };

export default function Page() {
  return <Ideas />;
}
