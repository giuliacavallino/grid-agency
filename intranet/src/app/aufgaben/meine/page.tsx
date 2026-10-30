import type { Metadata } from "next";
import { MyTasks } from "@/components/aufgaben/my-tasks";

export const metadata: Metadata = { title: "Meine To-dos" };

export default function MeinePage() {
  return <MyTasks />;
}
