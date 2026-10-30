import type { Metadata } from "next";
import { JobPostings } from "@/components/personal/job-postings";

export const metadata: Metadata = { title: "Stellen" };

export default function StellenPage() {
  return <JobPostings />;
}
