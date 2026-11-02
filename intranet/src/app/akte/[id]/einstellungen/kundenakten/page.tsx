import type { Metadata } from "next";
import { Workspaces } from "@/components/marketing/hub";

export const metadata: Metadata = { title: "Kundenakten" };

export default function Page() {
  return <Workspaces />;
}
