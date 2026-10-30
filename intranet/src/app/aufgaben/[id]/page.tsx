import { ProjectBoard } from "@/components/aufgaben/project-board";

export default async function ProjectPage({ params }: PageProps<"/aufgaben/[id]">) {
  const { id } = await params;
  return <ProjectBoard id={id} />;
}
