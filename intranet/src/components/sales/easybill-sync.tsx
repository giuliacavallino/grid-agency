"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate, useResource } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { Button, useToast } from "@/components/ui";

type Result = {
  at: string;
  customers: { created: number; updated: number };
  articles: { created: number; updated: number };
  retainers: { created: number; updated: number };
  offers: { created: number };
};

const URL = "/api/sales/sync/easybill";

/** Knopf „easybill abgleichen“: holt Kunden, Artikel, Serienrechnungen
 * (Retainer) und offene Angebote aus easybill. */
export function EasybillSync() {
  const { data, reload } = useResource<{ last: Result | null; configured: boolean }>(URL);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function run() {
    setBusy(true);
    try {
      const r = await api<Result>(URL, { method: "POST" });
      ["customers", "articles", "retainers", "leads"].forEach((t) => revalidate(`/api/sales/${t}`));
      reload();
      toast(
        `easybill: ${r.customers.created} neue Kund*innen, ${r.retainers.created} neue Retainer, ` +
          `${r.articles.created} neue Artikel, ${r.offers.created} offene Angebote`
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : "Abgleich fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  const title = !data?.configured
    ? "EASYBILL_API_KEY fehlt in Vercel"
    : data.last
      ? `Zuletzt abgeglichen: ${formatDateTime(data.last.at)}`
      : "Noch nie abgeglichen";

  return (
    <Button
      size="sm"
      className="h-9 px-2.5 sm:px-3"
      icon={<RefreshCw className="h-4 w-4" />}
      onClick={run}
      loading={busy}
      loadingText="Wird abgeglichen …"
      disabled={!data?.configured}
      title={title}
      aria-label="Mit easybill abgleichen"
    >
      <span className="hidden sm:inline">easybill</span>
    </Button>
  );
}
