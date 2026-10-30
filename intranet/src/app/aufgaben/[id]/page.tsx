import { ProjectView } from "@/components/aufgaben/project";

export default async function ProjectPage({ params }: PageProps<"/aufgaben/[id]">) {
  const { id } = await params;
  return <ProjectView id={id} />;
}
