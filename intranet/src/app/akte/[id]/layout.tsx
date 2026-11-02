import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";
import { AkteShell } from "@/components/akte/shell";

export const metadata: Metadata = { title: { template: "%s · Kundenakte", default: "Kundenakte" } };

export default async function AkteLayout({ children, params }: LayoutProps<"/akte/[id]">) {
  const { id } = await params;
  return (
    <RequireAuth>
      <AkteShell id={id}>{children}</AkteShell>
    </RequireAuth>
  );
}
