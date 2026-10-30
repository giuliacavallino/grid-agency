import type { Metadata } from "next";
import { Audit } from "@/components/admin/audit";

export const metadata: Metadata = { title: "Protokoll" };

export default function ProtokollPage() {
  return <Audit />;
}
