import { AkteRedirect } from "@/components/akte/pages";

/** /marketing/… → Kundenakte (GRID, oder ?welt=<id>) */
export default async function Page({ params }: PageProps<"/marketing/[[...rest]]">) {
  const { rest } = await params;
  return <AkteRedirect path={(rest ?? []).join("/")} />;
}
