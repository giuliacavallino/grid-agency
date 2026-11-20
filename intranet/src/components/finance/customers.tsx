"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRows } from "@/lib/data";
import type { Customer } from "@/lib/sales/types";
import { Button, Empty, Spinner } from "@/components/ui";
import { Card, Chip, Missing, Page, PageHead, SearchPill, Segmented, SortTh, compare, rowClass, tdClass, thClass, type SortDir } from "./kit";

type Tab = Customer["status"] | "alle";
type SortKey = "number" | "name" | "contact";

/** Rechnungsadresse für Rechnungen: eigene Rechnungsmail, sonst die allgemeine */
const invoiceMail = (c: Customer) => c.billing_email || c.email;

/** Finance → Kunden: Rechnungsdaten auf einen Blick (Nummer, Anschrift,
 * Ansprechpartner, Rechnungsmail, Zahlart). Bearbeitet wird im Kundenblatt
 * unter Sales → Kunden. */
export function FinanceCustomers() {
  const { data: customers, loading, error } = useRows<Customer>("customers");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("aktiv");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "number", dir: 1 });
  const [leaving, setLeaving] = useState<string | null>(null);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const go = (key: string, href: string) => {
    setLeaving(key);
    router.push(href);
  };

  const counts = useMemo(() => {
    const map: Record<Tab, number> = { aktiv: 0, pausiert: 0, ehemalig: 0, alle: customers?.length ?? 0 };
    for (const c of customers ?? []) map[c.status]++;
    return map;
  }, [customers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (c: Customer) => ({ number: c.customer_number, name: c.name, contact: c.contact_name })[sort.key];
    return (customers ?? [])
      .filter((c) => tab === "alle" || c.status === tab)
      .filter((c) => !q || [c.customer_number, c.name, c.contact_name, c.email, c.billing_email, c.city, c.zip].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => compare(value(a), value(b), sort.dir) || a.name.localeCompare(b.name, "de"));
  }, [customers, tab, query, sort]);

  const noMail = (customers ?? []).filter((c) => c.status === "aktiv" && !invoiceMail(c)).length;
  const sepa = (customers ?? []).filter((c) => c.status === "aktiv" && c.sepa_mandate_reference).length;

  return (
    <Page>
      <PageHead
        title="Kunden"
        meta={
          customers && (
            <>
              {counts.aktiv} aktiv · {sepa} mit SEPA-Mandat
              {noMail > 0 && <span className="text-error"> · {noMail} ohne Rechnungsmail</span>}
            </>
          )
        }
      >
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} loading={leaving === "neu"} loadingText="Wird geöffnet …" onClick={() => go("neu", "/sales/kunden")} title="Kunden werden unter Sales → Kunden angelegt">
          Neuer Kunde
        </Button>
      </PageHead>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Status"
          value={tab}
          onChange={setTab}
          options={[
            { id: "aktiv", label: "Aktiv", count: counts.aktiv },
            { id: "pausiert", label: "Pausiert", count: counts.pausiert },
            { id: "ehemalig", label: "Ehemalig", count: counts.ehemalig },
            { id: "alle", label: "Alle", count: counts.alle },
          ]}
        />
        <SearchPill value={query} onChange={setQuery} placeholder="Kunde, Nummer, Mail …" label="Kunden durchsuchen" className="ml-auto w-full sm:w-72" />
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <Empty title="Kunden konnten nicht geladen werden" text={error.message} />
        ) : loading ? (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <Empty icon={<Building2 className="h-8 w-8" />} title={customers?.length ? "Keine Treffer" : "Noch keine Kund*innen"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead>
                <tr>
                  <SortTh id="number" sort={sort} onSort={toggleSort} className="w-24">
                    Nr.
                  </SortTh>
                  <SortTh id="name" sort={sort} onSort={toggleSort}>
                    Kunde
                  </SortTh>
                  <SortTh id="contact" sort={sort} onSort={toggleSort}>
                    Ansprechpartner
                  </SortTh>
                  <th className={thClass}>Rechnungen an</th>
                  <th className={thClass}>Zahlung</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const place = [c.zip, c.city].filter(Boolean).join(" ");
                  const mail = invoiceMail(c);
                  const href = `/sales/kunden?id=${c.id}`;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => go(c.id, href)}
                      onKeyDown={(e) => e.key === "Enter" && go(c.id, href)}
                      tabIndex={0}
                      aria-busy={leaving === c.id || undefined}
                      className={cn(rowClass, leaving === c.id && "cursor-progress opacity-60")}
                    >
                      <td className={cn(tdClass, "text-snow/60 tabular-nums")}>{c.customer_number ?? <Missing />}</td>
                      <td className={cn(tdClass, "max-w-80")}>
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold">{c.name}</span>
                          {leaving === c.id && <Spinner className="h-3.5 w-3.5" />}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-snow/50">{place || <Missing>Anschrift fehlt</Missing>}</span>
                      </td>
                      <td className={cn(tdClass, "text-snow/75")}>{c.contact_name || <Missing />}</td>
                      <td className={cn(tdClass, "max-w-72 truncate text-snow/75")}>{mail || <Missing>Mail fehlt</Missing>}</td>
                      <td className={tdClass}>
                        {c.sepa_mandate_reference ? (
                          <Chip tone="green" title={`Mandat ${c.sepa_mandate_reference}`}>
                            SEPA-Mandat
                          </Chip>
                        ) : (
                          <Chip>Überweisung</Chip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
