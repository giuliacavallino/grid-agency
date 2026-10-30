import type { Metadata } from "next";
import { Workspaces } from "@/components/marketing/hub";

export const metadata: Metadata = { title: "Kundenwelten" };

export default function Page() {
  return <Workspaces />;
}
