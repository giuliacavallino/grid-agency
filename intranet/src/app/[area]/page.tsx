import { notFound } from "next/navigation";
import { AreaPlaceholder } from "@/components/hub";
import { RequireAuth } from "@/components/login";
import { AREAS } from "@/lib/areas";

// Bereiche ohne eigene Seite zeigen vorerst einen Platzhalter.
const BUILT = ["sales", "finance", "personal", "marketing", "mail", "aufgaben", "admin"];
const PLACEHOLDERS = AREAS.filter((area) => !area.external && !BUILT.includes(area.id));

export function generateStaticParams() {
  return PLACEHOLDERS.map((area) => ({ area: area.id }));
}

export const dynamicParams = false;

export default async function AreaPage({ params }: PageProps<"/[area]">) {
  const { area } = await params;
  if (!PLACEHOLDERS.some((a) => a.id === area)) notFound();
  return (
    <RequireAuth area={area}>
      <AreaPlaceholder id={area} />
    </RequireAuth>
  );
}
