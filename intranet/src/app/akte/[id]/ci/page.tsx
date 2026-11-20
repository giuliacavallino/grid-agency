import type { Metadata } from "next";
import { BrandWorld } from "@/components/marketing/brand";

export const metadata: Metadata = { title: "Markenkit" };

export default function Page() {
  return <BrandWorld />;
}
