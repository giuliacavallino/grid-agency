import type { Metadata } from "next";
import { Articles } from "@/components/sales/articles";

export const metadata: Metadata = { title: "Artikel" };

export default function ArticlesPage() {
  return <Articles />;
}
