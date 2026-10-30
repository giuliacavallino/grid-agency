import type { Metadata } from "next";
import { Members } from "@/components/admin/members";

export const metadata: Metadata = { title: "Benutzer & Rechte" };

export default function BenutzerPage() {
  return <Members />;
}
