import type { Metadata } from "next";
import { AutopilotSettings } from "@/components/akte/settings";

export const metadata: Metadata = { title: "Autopilot" };

export default function Page() {
  return <AutopilotSettings />;
}
