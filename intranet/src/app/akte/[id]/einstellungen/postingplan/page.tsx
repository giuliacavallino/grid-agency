import type { Metadata } from "next";
import { PostingPlanSettings } from "@/components/akte/posting-plan";

export const metadata: Metadata = { title: "Postingplan" };

export default function Page() {
  return <PostingPlanSettings />;
}
