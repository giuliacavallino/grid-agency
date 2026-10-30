import type { Metadata } from "next";
import { Posts } from "@/components/marketing/posts";

export const metadata: Metadata = { title: "Posts & Planung" };

export default function Page() {
  return <Posts />;
}
