import type { Metadata } from "next";
import { SenderSettings } from "@/components/admin/sender";

export const metadata: Metadata = { title: "Absender & Updates" };

export default function AbsenderPage() {
  return <SenderSettings />;
}
