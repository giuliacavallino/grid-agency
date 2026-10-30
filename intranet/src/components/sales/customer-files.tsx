"use client";

import { useState } from "react";
import { FileCheck2 } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { Customer } from "@/lib/sales/types";
import { Spinner, useToast } from "@/components/ui";

type CustomerFile = { id: string; created_at: string; kind: string; title: string };

/** Kundenakte: unterschriebene Unterlagen (Angebot, Vertrag, SEPA-Mandat) */
export function CustomerFiles({ customer }: { customer: Customer }) {
  const { data, loading } = useResource<CustomerFile[]>(`/api/finance/unterlagen?customer_id=${customer.id}`);
  const toast = useToast();
  const [opening, setOpening] = useState<string | null>(null);

  async function open(id: string) {
    setOpening(id);
    const tab = window.open("", "_blank");
    try {
      const { url } = await api<{ url: string }>(`/api/finance/unterlagen/${id}`);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch {
      tab?.close();
      toast("PDF konnte nicht geöffnet werden", "error");
    }
    setOpening(null);
  }

  return (
    <section>
      <p className="mb-2 text-xs font-medium text-snow/60">Kundenakte</p>
      {customer.sepa_mandate_reference && (
        <p className="mb-2 rounded-2xl bg-ink/60 px-4 py-3 text-[13px] text-snow/70">
          SEPA-Mandat {customer.sepa_mandate_reference} · {customer.sepa_holder} · IBAN …{customer.sepa_iban?.slice(-4)}
          {customer.sepa_signed_at ? ` · seit ${formatDate(customer.sepa_signed_at)}` : ""}
        </p>
      )}
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <p className="rounded-2xl bg-ink/60 px-4 py-5 text-center text-sm text-snow/45">Noch keine unterschriebenen Unterlagen.</p>
      ) : (
        <ul className="divide-y divide-snow/[0.06] rounded-2xl border border-snow/[0.08]">
          {data.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => open(f.id)}
                disabled={opening === f.id}
                aria-busy={opening === f.id || undefined}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-snow/[0.04]"
              >
                <FileCheck2 className="h-4 w-4 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">{f.title}</span>
                <span className="shrink-0 tabular-nums text-snow/50">{formatDate(f.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
