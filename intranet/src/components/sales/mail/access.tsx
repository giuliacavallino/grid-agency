"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { ConsentRequiredError, requestConsent } from "@/lib/auth";
import { GraphError, graphErrorMessage, isAccessDenied } from "@/lib/graph";
import { Button } from "@/components/ui";

/** Hinweis, wenn Graph nicht liefert: Zustimmung fehlt, kein Postfachzugriff
 * oder ein anderer Fehler. Gilt für Posteingang und Kalender. */
export function GraphProblem({ error, scopes, onRetry }: { error: unknown; scopes: string[]; onRetry: () => void }) {
  const [busy, setBusy] = useState(false);

  if (error instanceof ConsentRequiredError) {
    return (
      <Panel icon={<ShieldCheck className="h-6 w-6" />} title="Zugriff auf die Postfächer erlauben">
        <p>
          Damit das Intranet die Postfächer anzeigen kann, braucht es einmal deine Zustimmung bei Microsoft.
          Danach geht es automatisch hierher zurück.
        </p>
        <Button
          variant="primary"
          className="mt-5"
          loading={busy}
          loadingText="Weiterleitung zu Microsoft …"
          onClick={() => {
            setBusy(true);
            requestConsent(scopes).catch(() => setBusy(false));
          }}
        >
          Zugriff erlauben
        </Button>
      </Panel>
    );
  }

  const denied = isAccessDenied(error);
  const mailbox = error instanceof GraphError ? error.mailbox : undefined;
  return (
    <Panel
      icon={<TriangleAlert className="h-6 w-6" />}
      title={denied ? `Kein Zugriff auf ${mailbox ?? "das Postfach"}` : "Laden fehlgeschlagen"}
    >
      <p>{graphErrorMessage(error)}</p>
      <Button className="mt-5" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
        Erneut versuchen
      </Button>
    </Panel>
  );
}

function Panel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="max-w-md rounded-3xl border border-snow/10 bg-surface p-7 text-center text-sm leading-relaxed text-snow/65">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-snow/10 text-snow">{icon}</div>
        <h2 className="mb-2 text-lg font-medium text-snow">{title}</h2>
        {children}
      </div>
    </div>
  );
}
