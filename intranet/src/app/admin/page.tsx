import type { Metadata } from "next";
import { Vault } from "@/components/admin/vault";

export const metadata: Metadata = { title: "Passwörter" };

export default function AdminPage() {
  return <Vault />;
}
