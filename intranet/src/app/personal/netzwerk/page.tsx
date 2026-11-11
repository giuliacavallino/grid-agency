import type { Metadata } from "next";
import { Network } from "@/components/personal/network";

export const metadata: Metadata = { title: "Freelancer & Partner" };

export default function NetworkPage() {
  return <Network />;
}
