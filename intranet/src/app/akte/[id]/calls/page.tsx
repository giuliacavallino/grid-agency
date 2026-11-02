import type { Metadata } from "next";
import { AkteCalls } from "@/components/akte/pages";

export const metadata: Metadata = { title: "Calls & To-dos" };

export default function Page() {
  return <AkteCalls />;
}
