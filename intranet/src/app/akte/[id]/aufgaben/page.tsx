import type { Metadata } from "next";
import { AkteTasks } from "@/components/akte/pages";

export const metadata: Metadata = { title: "Aufgaben" };

export default function Page() {
  return <AkteTasks />;
}
