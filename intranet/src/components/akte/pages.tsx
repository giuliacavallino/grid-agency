"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate } from "@/lib/data";
import { useCan } from "@/components/access";
import { CallResults } from "@/components/aufgaben/calls";
import { ProjectView } from "@/components/aufgaben/project";
import { Button, Empty, Spinner, useToast } from "@/components/ui";
import { URL_WORKSPACES, useCurrentWorkspace, useWorkspaces } from "@/components/marketing/workspace";
import { Cockpit } from "./cockpit";
import { AkteHeader } from "./header";

// Seiten der Kundenakte, die bestehende Ansichten auf den Kunden zuschneiden

/** Alte Marketing-Adressen → Kundenakte */
const OLD: Record<string, string> = { "": "", posts: "planung", kanaele: "einstellungen", ci: "ci", agent: "einstellungen/agent" };

export function AkteRedirect({ path }: { path: string }) {
  const router = useRouter();
  const { data } = useWorkspaces();
  useEffect(() => {
    if (!data) return;
    const params = new URLSearchParams(window.location.search);
    const target = data.find((w) => w.id === params.get("welt")) ?? data.find((w) => w.kind === "agency") ?? data[0];
    if (!target) return;
    params.delete("welt");
    const mapped = path in OLD ? OLD[path] : path;
    const query = params.toString();
    router.replace(`/akte/${target.id}${mapped ? `/${mapped}` : ""}${query ? `?${query}` : ""}`);
  }, [data, path, router]);
  return (
    <div className="grid h-dvh place-items-center bg-canvas">
      <Spinner />
    </div>
  );
}

/** Startseite: Cockpit (mit Marketing), sonst direkt die Aufgaben */
export function AkteHome() {
  const marketing = useCan("marketing");
  return marketing ? <Cockpit /> : <AkteTasks />;
}

function NoProject() {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const [busy, setBusy] = useState(false);
  if (!workspace) return null;
  async function create() {
    setBusy(true);
    try {
      const project = await api<{ id: string }>("/api/sales/task_projects", { method: "POST", body: JSON.stringify({ name: workspace!.name, color: workspace!.color }) });
      await api(`${URL_WORKSPACES}/${workspace!.id}`, { method: "PATCH", body: JSON.stringify({ project_id: project.id }) });
      revalidate(URL_WORKSPACES);
      revalidate("/api/sales/task_projects");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }
  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Aufgaben" />
      <Empty
        icon={<ListChecks className="h-8 w-8" />}
        title="Noch keine Aufgabenliste"
        text="Lege eine an: To-dos, Briefing und Calls dieses Kunden laufen dann hier zusammen."
        action={
          <Button variant="primary" loading={busy} loadingText="Wird angelegt …" onClick={create}>
            Aufgabenliste anlegen
          </Button>
        }
      />
    </div>
  );
}

export function AkteTasks() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  if (!workspace.project_id) return <NoProject />;
  return <ProjectView id={workspace.project_id} />;
}

export function AkteCalls() {
  const { workspace } = useCurrentWorkspace();
  if (!workspace) return null;
  if (!workspace.project_id) return <NoProject />;
  return <CallResults projectId={workspace.project_id} header={<AkteHeader title="Calls & To-dos" meta="Zusammenfassungen und To-dos aus Calls mit diesem Kunden – übernehmen oder direkt an den Agenten" />} />;
}
