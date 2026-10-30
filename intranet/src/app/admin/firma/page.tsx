import type { Metadata } from "next";
import { CompanySettings } from "@/components/admin/company";

export const metadata: Metadata = { title: "Firmendaten" };

export default function FirmaPage() {
  return <CompanySettings />;
}
