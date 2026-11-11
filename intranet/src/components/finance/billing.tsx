"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Building2, Eye, FileDown, MoreVertical, Plus, ReceiptText, Repeat, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useResource, useRows } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  KIND_GROUPS,
  KIND_LABEL,
  STATUS_LABEL,
  docLabel,
  isOverdue,
  money,
  plain,
  rhythm,
  type BillingAddress,
  type BillingDetail,
  type BillingDocument,
  type BillingKind,
  type KindGroup,
} from "@/lib/billing";
import type { Customer } from "@/lib/sales/types";
import { useCan } from "@/components/access";
import { Badge, Button, Empty, IconButton, MenuItem, Popover, Select, Sheet, Spinner, useToast } from "@/components/ui";
import { BillingEditor, type EditorKind } from "./billing-editor";
import { DocumentActions, openPdf, removePayment } from "./billing-actions";
import { SignFolders } from "./sign-folder";
import { Card, Chip, Kpi, Page, PageHead, SearchPill, Segmented, SortTh, compare, pillButton, rowClass, tdClass, thClass, type SortDir } from "./kit";

const LIST_URL = "/api/finance/ausgang";

/** Umsatzwirksame Belege: Rechnungen abzüglich Gutschriften und Stornos */
const REVENUE_KINDS: BillingKind[] = ["rechnung", "gutschrift", "storno", "storno_gutschrift"];

/** Belegarten der Liste; Serien haben eine eigene Seite */
type ListGroup = Exclude<KindGroup, "serien">;
const LIST_GROUPS = KIND_GROUPS.filter((g) => g.id !== "serien");

const GROUP_TITLE: Record<ListGroup, string> = {
  rechnungen: "Rechnungen",
  angebote: "Angebote",
  mahnwesen: "Mahnwesen",
  sonstige: "Briefe & Sonstiges",
  alle: "Alle Belege",
};

const kindsOf = (group: ListGroup): readonly BillingKind[] =>
  group === "alle" ? REVENUE_KINDS.concat(["angebot", "auftrag", "zahlungserinnerung", "mahnung", "brief", "lieferschein", "proforma", "sonstiges"]) : KIND_GROUPS.find((g) => g.id === group)!.kinds;

const running = (doc: BillingDocument) => doc.recurring?.status === "RUNNING" || doc.recurring?.status === "WAITING";

const invoiceCount = (n: number) => `${n} ${n === 1 ? "Rechnung" : "Rechnungen"}`;

const open = (doc: BillingDocument) => Math.max(0, doc.amount_gross - doc.paid_amount);

const DAY = 86_400_000;
const daysLate = (doc: BillingDocument) => (doc.due_date ? Math.max(1, Math.floor((Date.now() - new Date(`${doc.due_date}T23:59:59`).getTime()) / DAY) + 1) : 0);

/** Festgeschrieben, aber noch nicht verschickt (nur Intranet-Belege; easybill-Importe haben keinen Versand) */
const unsent = (d: BillingDocument) =>
  d.source === "intranet" && !d.sent_at && !["entwurf", "storniert"].includes(d.status) && ["rechnung", "gutschrift", "storno", "storno_gutschrift"].includes(d.kind);

/** Braucht jemanden: Entwurf prüfen, verschicken oder nachfassen */
const todo = (d: BillingDocument) => (REVENUE_KINDS.includes(d.kind) && d.status === "entwurf") || isOverdue(d) || unsent(d);

type Filter = { id: string; label: string; test: (d: BillingDocument) => boolean; badge?: boolean; tone?: "error" };

/** Filter für Rechnungen und Gutschriften */
const INVOICE_FILTERS: Filter[] = [
  { id: "alle", label: "Alle", test: () => true },
  { id: "todo", label: "Zu tun", test: todo, badge: true },
  { id: "unsent", label: "Nicht verschickt", test: unsent },
  { id: "offen", label: "Offen", test: (d) => d.kind !== "gutschrift" && (d.status === "offen" || d.status === "teilbezahlt") },
  { id: "ueberfaellig", label: "Überfällig", test: isOverdue, badge: true, tone: "error" },
  { id: "bezahlt", label: "Bezahlt", test: (d) => d.status === "bezahlt" },
  { id: "erstattung", label: "Erstattung offen", test: (d) => d.kind === "gutschrift" && (d.status === "offen" || d.status === "teilbezahlt") },
];

/** Andere Belegarten: Alle und die vorkommenden Status */
function statusFilters(docs: BillingDocument[]): Filter[] {
  const present = [...new Set(docs.map((d) => d.status))];
  return [
    { id: "alle", label: "Alle", test: () => true },
    ...(Object.keys(STATUS_LABEL) as BillingDocument["status"][])
      .filter((s) => present.includes(s))
      .map((s) => ({ id: s, label: STATUS_LABEL[s], test: (d: BillingDocument) => d.status === s })),
  ];
}

/** Zahlart beim Kunden: mit SEPA-Mandat Lastschrift, sonst Überweisung */
const paymentOf = (c: Customer | undefined) => (c ? (c.sepa_mandate_reference ? "Lastschrift" : "Überweisung") : null);

/** Ausgangsrechnungen: alle Belege aus easybill und dem Intranet mit
 * Kennzahlen, Filtern und Beleg mit PDF. view „serien“ zeigt die
 * Serienrechnungen (eigene Seite unter Finance → Serien). */
export function Billing({ view = "belege" }: { view?: "belege" | "serien" }) {
  const { data: docs, loading, error } = useResource<BillingDocument[]>(LIST_URL);
  const { data: customers } = useRows<Customer>("customers");
  const [editor, setEditor] = useState<{ kind: EditorKind; doc: BillingDetail | null } | null>(null);

  // Geöffneter Beleg steht in der URL (?id=…), damit Links ihn öffnen
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = params.get("id");
  const show = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const customerById = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c])), [customers]);
  const list = { docs, loading, error, customers: customers ? customerById : null, show, create: (kind: EditorKind) => setEditor({ kind, doc: null }) };

  return (
    <>
      {view === "serien" ? <SeriesList {...list} /> : <DocumentList {...list} />}

      <DocumentSheet
        id={editor ? null : openId}
        onClose={() => show(null)}
        onOpen={(id) => show(id || null)}
        onEdit={(doc) => {
          show(doc.id);
          setEditor({ kind: doc.kind as EditorKind, doc });
        }}
      />
      <BillingEditor
        open={!!editor}
        kind={editor?.kind ?? "rechnung"}
        doc={editor?.doc ?? null}
        onClose={() => setEditor(null)}
        onSaved={(doc) => {
          setEditor(null);
          show(doc.id);
        }}
      />
    </>
  );
}

type ListProps = {
  docs: BillingDocument[] | undefined;
  loading: boolean;
  error: Error | undefined | null;
  /** null: keine Kundendaten (fehlendes Recht) – Spalten Kd.-Nr. und Zahlung entfallen */
  customers: Map<string, Customer> | null;
  show: (id: string | null) => void;
  create: (kind: EditorKind) => void;
};

const selectPill = "h-10 w-auto rounded-full border-snow/[0.08] bg-surface pl-4 shadow-[0_2px_10px_var(--shadow-color)]";

type DocSort = "number" | "date" | "customer" | "gross" | "due";

function DocumentList({ docs, loading, error, customers, show, create }: ListProps) {
  const [group, setGroup] = useState<ListGroup>("rechnungen");
  const [filter, setFilter] = useState("alle");
  const [year, setYear] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: DocSort; dir: SortDir }>({ key: "date", dir: -1 });
  const toggleSort = (key: DocSort) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "customer" ? 1 : -1 }));
  const canSales = useCan("sales");
  const [now] = useState(() => Date.now());

  const all = useMemo(() => (docs ?? []).filter((d) => d.kind !== "serie"), [docs]);
  const byId = useMemo(() => new Map(all.map((d) => [d.id, d])), [all]);
  /** Belege, die auf eine Rechnung verweisen (Storno, Gutschrift, Mahnung) */
  const refs = useMemo(() => {
    const map = new Map<string, BillingDocument[]>();
    for (const d of all) if (d.ref_document_id) map.set(d.ref_document_id, [...(map.get(d.ref_document_id) ?? []), d]);
    return map;
  }, [all]);

  const years = useMemo(() => [...new Set(all.map((d) => d.document_date?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(), [all]);

  const inGroup = useMemo(() => {
    const kinds = kindsOf(group);
    return all.filter((d) => kinds.includes(d.kind) && (!year || d.document_date?.startsWith(year)));
  }, [all, group, year]);

  const invoiceLike = group === "rechnungen" || group === "alle";
  const filters = useMemo(() => (invoiceLike ? INVOICE_FILTERS : statusFilters(inGroup)), [invoiceLike, inGroup]);
  const active = filters.find((f) => f.id === filter) ?? filters[0];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const test = (filters.find((f) => f.id === filter) ?? filters[0]).test;
    const value = (d: BillingDocument) =>
      ({
        number: d.number ?? "",
        date: d.document_date ?? "9999",
        customer: d.customer_name,
        gross: d.amount_gross,
        due: d.due_date,
      })[sort.key];
    return inGroup
      .filter(test)
      .filter((d) => !q || [d.number, d.title, d.customer_name, d.customer_id && customers?.get(d.customer_id)?.customer_number].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => compare(value(a), value(b), sort.dir) || compare(a.number, b.number, -1));
  }, [inGroup, filters, filter, query, sort, customers]);

  const stats = useMemo(() => {
    const invoices = all.filter((d) => d.kind === "rechnung");
    const openInvoices = invoices.filter((d) => d.status === "offen" || d.status === "teilbezahlt");
    const late = openInvoices.filter(isOverdue);
    const since = new Date(now - 30 * DAY).toISOString().slice(0, 10);
    const paid = invoices.filter((d) => d.paid_at && d.paid_at.slice(0, 10) >= since);
    const thisYear = String(new Date().getFullYear());
    return {
      open: openInvoices.length,
      openSum: openInvoices.reduce((sum, d) => sum + open(d), 0),
      late: late.length,
      lateSum: late.reduce((sum, d) => sum + open(d), 0),
      drafts: all.filter((d) => REVENUE_KINDS.includes(d.kind) && d.status === "entwurf").length,
      paid: paid.length,
      paidSum: paid.reduce((sum, d) => sum + d.paid_amount, 0),
      thisYear,
      revenue: all
        .filter((d) => REVENUE_KINDS.includes(d.kind) && d.status !== "entwurf" && d.document_date?.startsWith(thisYear))
        .reduce((sum, d) => sum + d.amount_net, 0),
    };
  }, [all, now]);

  const pick = (g: ListGroup, f = "alle") => {
    setGroup(g);
    setFilter(f);
  };

  const hasTitle = rows.some((d) => d.title);
  const showKind = group === "alle" || kindsOf(group).length > 1;
  const euro = rows.filter((d) => d.currency === "EUR");

  return (
    <Page wide>
      <PageHead
        title={GROUP_TITLE[group]}
        meta={docs && `Umsatz ${stats.thisYear}: ${money(stats.revenue)} netto, nach Stornos`}
      >
        <Button className={pillButton} icon={<Plus className="h-4 w-4" />} onClick={() => create("angebot")}>
          Neues Angebot
        </Button>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => create("rechnung")}>
          Neue Rechnung
        </Button>
      </PageHead>

      {docs && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi label="Offen" value={money(stats.openSum)} hint={invoiceCount(stats.open)} onClick={() => pick("rechnungen", "offen")} />
          <Kpi
            label="Überfällig"
            value={money(stats.lateSum)}
            tone={stats.late ? "error" : undefined}
            hint={
              stats.late ? (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> nachfassen · {invoiceCount(stats.late)}
                </span>
              ) : (
                "nichts überfällig"
              )
            }
            onClick={stats.late ? () => pick("rechnungen", "ueberfaellig") : undefined}
          />
          <Kpi label="Entwürfe" value={String(stats.drafts)} hint="prüfen und verschicken" onClick={stats.drafts ? () => pick("rechnungen", "todo") : undefined} />
          <Kpi label="Bezahlt (30 Tage)" value={money(stats.paidSum)} hint={invoiceCount(stats.paid)} onClick={() => pick("rechnungen", "bezahlt")} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Status"
          value={active.id}
          onChange={setFilter}
          options={filters.map((f) => ({ id: f.id, label: f.label, tone: f.tone, count: f.badge ? inGroup.filter(f.test).length : undefined }))}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={group} onChange={(e) => pick(e.target.value as ListGroup)} className={selectPill} aria-label="Belegart">
            {[...LIST_GROUPS.map((g) => ({ id: g.id, label: g.label })), { id: "alle", label: "Alle Belege" }].map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
          <Select value={year} onChange={(e) => setYear(e.target.value)} className={cn(selectPill, "hidden sm:flex")} aria-label="Jahr">
            <option value="">Alle Jahre</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <SearchPill value={query} onChange={setQuery} placeholder="Nummer oder Kunde …" label="Belege durchsuchen" className="w-full sm:w-64" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <Empty title="Belege konnten nicht geladen werden" text={error.message} />
        ) : loading ? (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<ReceiptText className="h-8 w-8" />}
            title={all.length ? "Keine Treffer" : "Noch keine Belege"}
            text={all.length ? "In dieser Ansicht gibt es gerade nichts." : "Die easybill-Historie ist noch nicht importiert."}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr>
                    <th className={cn(thClass, "w-10 pr-0")}>
                      <span className="sr-only">Aktionen</span>
                    </th>
                    <SortTh id="number" sort={sort} onSort={toggleSort} className="pl-2">
                      Nr.
                    </SortTh>
                    {invoiceLike && <th className={thClass}>Korr./Storno</th>}
                    <SortTh id="date" sort={sort} onSort={toggleSort}>
                      Datum
                    </SortTh>
                    {customers && <th className={thClass}>Kd.-Nr.</th>}
                    <SortTh id="customer" sort={sort} onSort={toggleSort}>
                      Kunde
                    </SortTh>
                    {hasTitle && <th className={thClass}>Leistung</th>}
                    <th className={cn(thClass, "text-right")}>Netto</th>
                    <th className={cn(thClass, "text-right")}>USt</th>
                    <SortTh id="gross" sort={sort} onSort={toggleSort} className="text-right">
                      Brutto
                    </SortTh>
                    <SortTh id="due" sort={sort} onSort={toggleSort}>
                      Fällig
                    </SortTh>
                    <th className={thClass}>Stand</th>
                    {customers && <th className={thClass}>Zahlung</th>}
                    {invoiceLike && <th className={thClass}>Mahnwesen</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d, index) => {
                    const customer = d.customer_id ? customers?.get(d.customer_id) : undefined;
                    const linked = refs.get(d.id) ?? [];
                    const corrections = linked.filter((r) => ["storno", "storno_gutschrift", "gutschrift"].includes(r.kind));
                    // Mahnbelege aus easybill plus im Intranet versendete Zahlungserinnerungen
                    const reminders = [
                      ...linked.filter((r) => r.kind === "zahlungserinnerung" || r.kind === "mahnung"),
                      ...(d.reminders ?? []).map((r) => ({ kind: "zahlungserinnerung" as const, document_date: r.at.slice(0, 10) })),
                    ];
                    const original = d.ref_document_id ? byId.get(d.ref_document_id) : undefined;
                    const late = isOverdue(d);
                    const cancelled = d.status === "storniert";
                    return (
                      <tr key={d.id} onClick={() => show(d.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && show(d.id)} className={rowClass}>
                        <td className={cn(tdClass, "w-10 pr-0")} onClick={(e) => e.stopPropagation()}>
                          <RowMenu doc={d} onOpen={() => show(d.id)} canSales={canSales} up={rows.length > 3 && index >= rows.length - 2} />
                        </td>
                        <td className={cn(tdClass, "pl-2 whitespace-nowrap")}>
                          <span className="font-medium tabular-nums underline decoration-snow/30 underline-offset-[3px]">{docLabel(d)}</span>
                          {showKind && d.kind !== "rechnung" && <span className="block text-[12px] text-snow/45">{KIND_LABEL[d.kind]}</span>}
                        </td>
                        {invoiceLike && (
                          <td className={cn(tdClass, "whitespace-nowrap text-snow/60 tabular-nums")}>
                            {corrections.length ? (
                              corrections.map((c) => (
                                <span key={c.id} className="block" title={KIND_LABEL[c.kind]}>
                                  {c.kind === "gutschrift" ? "GS" : "ST"} {docLabel(c)}
                                </span>
                              ))
                            ) : original && original.kind !== "serie" && REVENUE_KINDS.includes(d.kind) && d.kind !== "rechnung" ? (
                              <span title={`zu ${KIND_LABEL[original.kind]}`}>zu {docLabel(original)}</span>
                            ) : (
                              <span className="text-snow/30">–</span>
                            )}
                          </td>
                        )}
                        <td className={cn(tdClass, "whitespace-nowrap text-snow/70 tabular-nums")}>{formatDate(d.document_date)}</td>
                        {customers && <td className={cn(tdClass, "text-snow/60 tabular-nums")}>{customer?.customer_number ?? "–"}</td>}
                        <td className={cn(tdClass, "max-w-64")}>
                          <span className="block truncate underline decoration-snow/25 underline-offset-[3px]">{d.customer_name ?? "–"}</span>
                        </td>
                        {hasTitle && <td className={cn(tdClass, "max-w-56 truncate text-snow/60")}>{plain(d.title) || "–"}</td>}
                        <td className={cn(tdClass, "text-right whitespace-nowrap text-snow/70 tabular-nums", cancelled && "line-through opacity-60")}>
                          {d.amount_net ? money(d.amount_net, d.currency) : "–"}
                        </td>
                        <td className={cn(tdClass, "text-right whitespace-nowrap text-snow/55 tabular-nums", cancelled && "line-through opacity-60")}>
                          {d.amount_net ? money(d.amount_gross - d.amount_net, d.currency) : "–"}
                        </td>
                        <td className={cn(tdClass, "text-right font-semibold whitespace-nowrap tabular-nums", cancelled && "line-through opacity-60")}>
                          {d.amount_gross ? money(d.amount_gross, d.currency) : "–"}
                        </td>
                        <td className={cn(tdClass, "whitespace-nowrap tabular-nums", late ? "font-medium text-error" : "text-snow/70")}>{formatDate(d.due_date)}</td>
                        <td className={tdClass}>
                          <StatusBadge doc={d} />
                        </td>
                        {customers && <td className={cn(tdClass, "whitespace-nowrap text-snow/65")}>{paymentOf(customer) ?? "–"}</td>}
                        {invoiceLike && (
                          <td className={tdClass}>
                            {reminders.length ? (
                              <Chip tone={reminders.some((r) => r.kind === "mahnung") ? "red" : "amber"} title={reminders.map((r) => `${KIND_LABEL[r.kind]} ${formatDate(r.document_date)}`).join(", ")}>
                                {reminders.some((r) => r.kind === "mahnung") ? "Mahnung" : "Erinnerung"}
                                {reminders.length > 1 && ` · ${reminders.length}`}
                              </Chip>
                            ) : (
                              <span className="text-snow/30">–</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-snow/[0.06] md:hidden">
              {rows.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => show(d.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{d.customer_name ?? "–"}</span>
                      <span className="block truncate text-[12px] text-snow/55">
                        {docLabel(d)} · {formatDate(d.document_date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] font-semibold tabular-nums">{d.amount_gross ? money(d.amount_gross, d.currency) : "–"}</span>
                      <span className="mt-1 block">
                        <StatusBadge doc={d} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap gap-x-4 border-t border-snow/[0.06] px-6 py-3.5 text-[12.5px] text-snow/50">
              <span>
                {rows.length} {rows.length === 1 ? "Beleg" : "Belege"}
              </span>
              <span className="ml-auto tabular-nums">
                Summe brutto <span className="font-semibold text-snow">{money(euro.reduce((sum, d) => sum + d.amount_gross, 0))}</span>
                {euro.length < rows.length && ` (ohne ${rows.length - euro.length} in Fremdwährung)`}
              </span>
            </p>
          </>
        )}
      </Card>
    </Page>
  );
}

/** ⋮-Menü einer Zeile: öffnen, PDF, Kunde */
function RowMenu({ doc, onOpen, canSales, up }: { doc: BillingDocument; onOpen: () => void; canSales: boolean; up?: boolean }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  return (
    <Popover
      align="left"
      side={up ? "top" : "bottom"}
      trigger={({ toggle, open }) => (
        <IconButton label="Aktionen" onClick={toggle} active={open} className="rounded-full text-snow/45">
          <MoreVertical className="h-4 w-4" />
        </IconButton>
      )}
    >
      {(close) => (
        <>
          <MenuItem
            icon={<Eye className="h-4 w-4" />}
            onClick={() => {
              close();
              onOpen();
            }}
          >
            Öffnen
          </MenuItem>
          {doc.has_pdf && (
            <MenuItem
              icon={opening ? <Spinner className="h-4 w-4" /> : <FileDown className="h-4 w-4" />}
              disabled={opening}
              aria-busy={opening || undefined}
              onClick={async () => {
                setOpening(true);
                try {
                  await openPdf(doc.id);
                } catch {
                  toast("PDF konnte nicht geöffnet werden", "error");
                }
                setOpening(false);
                close();
              }}
            >
              {opening ? "Wird geöffnet …" : "PDF öffnen"}
            </MenuItem>
          )}
          {canSales && doc.customer_id && (
            <Link href={`/sales/kunden?id=${doc.customer_id}`} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-snow/85 hover:bg-snow/[0.08] hover:text-snow">
              <Building2 className="h-4 w-4" /> Zum Kunden
            </Link>
          )}
        </>
      )}
    </Popover>
  );
}

// ---------- Serien ----------

type SeriesTab = "laufend" | "pausiert" | "beendet";
const seriesTab = (d: BillingDocument): SeriesTab => (running(d) ? "laufend" : d.recurring?.status === "PAUSE" ? "pausiert" : "beendet");

type SeriesSort = "customer" | "title" | "next" | "net";

function SeriesList({ docs, loading, error, customers, show, create }: ListProps) {
  const [tab, setTab] = useState<SeriesTab>("laufend");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SeriesSort; dir: SortDir }>({ key: "next", dir: 1 });
  const toggleSort = (key: SeriesSort) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "net" ? -1 : 1 }));

  const series = useMemo(() => (docs ?? []).filter((d) => d.kind === "serie"), [docs]);
  /** Bisher erzeugte Rechnungen je Serie (verweisen per ref_document_id auf sie) */
  const issued = useMemo(() => {
    const map = new Map<string, BillingDocument[]>();
    for (const d of docs ?? []) if (d.kind === "rechnung" && d.ref_document_id) map.set(d.ref_document_id, [...(map.get(d.ref_document_id) ?? []), d]);
    return map;
  }, [docs]);

  const counts = useMemo(() => {
    const map: Record<SeriesTab, number> = { laufend: 0, pausiert: 0, beendet: 0 };
    for (const s of series) map[seriesTab(s)]++;
    return map;
  }, [series]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (d: BillingDocument) => ({ customer: d.customer_name, title: d.title ?? d.number, next: d.recurring?.next_date, net: d.amount_net })[sort.key];
    return series
      .filter((d) => seriesTab(d) === tab)
      .filter((d) => !q || [d.customer_name, d.title, d.number].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => compare(value(a), value(b), sort.dir) || compare(a.customer_name, b.customer_name, 1));
  }, [series, tab, query, sort]);

  const runningNet = series.filter(running).reduce((sum, d) => sum + d.amount_net, 0);

  return (
    <Page wide>
      <PageHead title="Serien" meta={docs && `${counts.laufend} laufend · ${money(runningNet)} netto je Lauf`}>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => create("serie")}>
          Neue Serie
        </Button>
      </PageHead>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Stand"
          value={tab}
          onChange={setTab}
          options={[
            { id: "laufend", label: "Laufend", count: counts.laufend },
            { id: "pausiert", label: "Pausiert", count: counts.pausiert },
            { id: "beendet", label: "Beendet", count: counts.beendet },
          ]}
        />
        <SearchPill value={query} onChange={setQuery} placeholder="Kunde oder Titel …" label="Serien durchsuchen" className="ml-auto w-full sm:w-72" />
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <Empty title="Serien konnten nicht geladen werden" text={error.message} />
        ) : loading ? (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            icon={<Repeat className="h-8 w-8" />}
            title={series.length ? "Keine Serien in dieser Ansicht" : "Noch keine Serien"}
            text={series.length ? undefined : "Mit „Neue Serie“ entstehen Rechnungen automatisch im gewählten Rhythmus."}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr>
                    <SortTh id="customer" sort={sort} onSort={toggleSort}>
                      Kunde
                    </SortTh>
                    <SortTh id="title" sort={sort} onSort={toggleSort}>
                      Titel
                    </SortTh>
                    <th className={thClass}>Rhythmus</th>
                    <SortTh id="next" sort={sort} onSort={toggleSort}>
                      Nächste
                    </SortTh>
                    <SortTh id="net" sort={sort} onSort={toggleSort} className="text-right">
                      Netto je Rechnung
                    </SortTh>
                    {customers && <th className={thClass}>Zahlung</th>}
                    <th className={thClass}>Versand</th>
                    <th className={cn(thClass, "text-right")}>Bisher</th>
                    <th className={thClass}>Stand</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const done = issued.get(d.id) ?? [];
                    return (
                      <tr key={d.id} onClick={() => show(d.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && show(d.id)} className={rowClass}>
                        <td className={cn(tdClass, "max-w-64")}>
                          <span className="block truncate font-medium underline decoration-snow/25 underline-offset-[3px]">{d.customer_name ?? "–"}</span>
                        </td>
                        <td className={cn(tdClass, "max-w-72 truncate text-snow/75")}>{plain(d.title) || d.number || "–"}</td>
                        <td className={cn(tdClass, "whitespace-nowrap text-snow/70")}>{rhythm(d.recurring) ?? "–"}</td>
                        <td className={cn(tdClass, "whitespace-nowrap tabular-nums")}>{formatDate(d.recurring?.next_date)}</td>
                        <td className={cn(tdClass, "text-right font-semibold whitespace-nowrap tabular-nums")}>{money(d.amount_net, d.currency)}</td>
                        {customers && <td className={cn(tdClass, "whitespace-nowrap text-snow/65")}>{paymentOf(d.customer_id ? customers.get(d.customer_id) : undefined) ?? "–"}</td>}
                        <td className={cn(tdClass, "whitespace-nowrap text-snow/65")}>
                          {d.recurring?.managed_by === "intranet" ? "automatisch per Mail" : <span title="Läuft weiter in easybill, bis sie übernommen wird">über easybill</span>}
                        </td>
                        <td className={cn(tdClass, "text-right whitespace-nowrap tabular-nums")}>
                          {done.length ? (
                            <>
                              <span className="block">{invoiceCount(done.length)}</span>
                              <span className="block text-[12px] text-snow/45">{money(done.reduce((sum, r) => sum + r.amount_gross, 0), d.currency)}</span>
                            </>
                          ) : (
                            <span className="text-snow/30">–</span>
                          )}
                        </td>
                        <td className={tdClass}>
                          <StatusBadge doc={d} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-snow/[0.06] md:hidden">
              {rows.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => show(d.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{d.customer_name ?? "–"}</span>
                      <span className="block truncate text-[12px] text-snow/55">
                        {rhythm(d.recurring)} · nächste {formatDate(d.recurring?.next_date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] font-semibold tabular-nums">{money(d.amount_net, d.currency)}</span>
                      <span className="mt-1 block">
                        <StatusBadge doc={d} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </Page>
  );
}

function StatusBadge({ doc }: { doc: BillingDocument }) {
  if (doc.kind === "serie") {
    const s = doc.recurring?.status ?? "STOP";
    return s === "PAUSE" ? <Chip tone="amber">pausiert</Chip> : s === "STOP" ? <Chip>beendet</Chip> : <Chip tone="green">läuft</Chip>;
  }
  if (isOverdue(doc)) return <Chip tone="red">Überfällig · {daysLate(doc)} T.</Chip>;
  if ((doc.kind === "storno" || doc.kind === "storno_gutschrift") && (doc.status === "erledigt" || doc.status === "bezahlt")) return <Chip>Verrechnet</Chip>;
  const tone: Record<BillingDocument["status"], Parameters<typeof Chip>[0]["tone"]> = {
    entwurf: "grey",
    offen: "lavender",
    teilbezahlt: "blue",
    bezahlt: "green",
    angenommen: "green",
    abgelehnt: "red",
    storniert: "grey",
    erledigt: "grey",
  };
  return <Chip tone={tone[doc.status]}>{STATUS_LABEL[doc.status]}</Chip>;
}

// ---------- Beleg ----------

function addressLines(address: BillingAddress | null) {
  if (!address) return [];
  const person = [address.first_name, address.last_name].filter(Boolean).join(" ");
  return [
    address.company_name,
    person,
    address.suffix_1,
    address.suffix_2,
    address.street,
    [address.zip_code, address.city].filter(Boolean).join(" "),
    address.country && address.country !== "DE" ? address.country : null,
  ].filter((line): line is string => !!line?.trim());
}

function servicePeriod(doc: BillingDetail) {
  if (doc.service_text) return plain(doc.service_text);
  if (!doc.service_from) return null;
  return doc.service_to && doc.service_to !== doc.service_from
    ? `${formatDate(doc.service_from)} – ${formatDate(doc.service_to)}`
    : formatDate(doc.service_from);
}

const quantity = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

function DocumentSheet({
  id,
  onClose,
  onOpen,
  onEdit,
}: {
  id: string | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onEdit: (doc: BillingDetail) => void;
}) {
  const { data: doc, error, loading } = useResource<BillingDetail>(id ? `${LIST_URL}/${id}` : null);
  const [opening, setOpening] = useState(false);
  const toast = useToast();

  // Signierte Links laufen nach 10 Minuten ab, daher erst beim Klick holen
  async function pdf() {
    if (!id) return;
    setOpening(true);
    try {
      await openPdf(id);
    } catch {
      toast("PDF konnte nicht geöffnet werden", "error");
    }
    setOpening(false);
  }

  const current = doc?.id === id ? doc : undefined;

  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      width="max-w-2xl"
      title={current ? `${KIND_LABEL[current.kind]} ${docLabel(current)}` : "Beleg"}
      subtitle={current && [current.customer_name, formatDate(current.document_date)].filter((v) => v && v !== "–").join(" · ")}
      actions={
        current?.has_pdf && (
          <Button size="sm" icon={<FileDown className="h-4 w-4" />} loading={opening} loadingText="Wird geöffnet …" onClick={pdf}>
            PDF
          </Button>
        )
      }
    >
      {error ? (
        <Empty title="Beleg konnte nicht geladen werden" text={error.message} />
      ) : loading || !current ? (
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      ) : (
        <DocumentBody doc={current} onOpen={onOpen} onEdit={onEdit} />
      )}
    </Sheet>
  );
}

function DocumentBody({ doc, onOpen, onEdit }: { doc: BillingDetail; onOpen: (id: string) => void; onEdit: (doc: BillingDetail) => void }) {
  const toast = useToast();
  const [removing, setRemoving] = useState<string | null>(null);
  const lines = addressLines(doc.address);
  const period = servicePeriod(doc);
  const payable = ["rechnung", "gutschrift", "proforma"].includes(doc.kind) && ["offen", "teilbezahlt", "bezahlt"].includes(doc.status);

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge doc={doc} />
        {doc.source === "easybill" && <Badge>aus easybill</Badge>}
        {doc.kind === "serie" && <Badge>{doc.recurring?.managed_by === "intranet" ? "läuft im Intranet" : "läuft in easybill"}</Badge>}
        {doc.sent_at && <Badge>gesendet {formatDateTime(doc.sent_at)}</Badge>}
      </div>

      <DocumentActions doc={doc} onOpen={onOpen} onEdit={onEdit} />

      {doc.send_error && !doc.sent_at && (
        <p className="flex items-start gap-2 rounded-2xl bg-error/10 px-4 py-3 text-[13px] text-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Automatischer Versand fehlgeschlagen: {doc.send_error}. Bitte über „Senden“ verschicken.</span>
        </p>
      )}

      {doc.amount_gross !== 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Amount label="Netto" value={money(doc.amount_net, doc.currency)} />
          <Amount label="USt" value={money(doc.amount_vat, doc.currency)} />
          <Amount label="Brutto" value={money(doc.amount_gross, doc.currency)} strong />
          {payable && (
            <Amount
              label={doc.status === "bezahlt" ? "Bezahlt" : "Offen"}
              value={money(doc.status === "bezahlt" ? doc.paid_amount : open(doc), doc.currency)}
              tone={isOverdue(doc) ? "error" : doc.status === "bezahlt" ? "success" : undefined}
            />
          )}
        </dl>
      )}

      <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        <Fact label="Kunde">
          {doc.customer_id ? (
            <Link href={`/sales/kunden?id=${doc.customer_id}`} className="inline-flex items-center gap-1 hover:underline">
              {doc.customer_name}
              <ArrowUpRight className="h-3.5 w-3.5 text-snow/45" />
            </Link>
          ) : (
            (doc.customer_name ?? "–")
          )}
        </Fact>
        {lines.length > 0 && <Fact label="Anschrift">{lines.join(", ")}</Fact>}
        {doc.kind === "serie" ? (
          <>
            <Fact label="Rhythmus">{rhythm(doc.recurring) ?? "–"}</Fact>
            <Fact label="Nächste Rechnung">{formatDate(doc.recurring?.next_date)}</Fact>
          </>
        ) : (
          <>
            <Fact label="Datum">{formatDate(doc.document_date)}</Fact>
            {doc.due_date && <Fact label="Fällig">{formatDate(doc.due_date)}</Fact>}
          </>
        )}
        {period && <Fact label="Leistung">{period}</Fact>}
        {doc.paid_at && <Fact label="Bezahlt am">{formatDate(doc.paid_at)}</Fact>}
        {doc.sent_to && <Fact label="Gesendet an">{doc.sent_to}</Fact>}
      </dl>

      {plain(doc.intro) && <p className="text-[13px] whitespace-pre-line text-snow/70">{plain(doc.intro)}</p>}

      {doc.items.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12px] font-medium text-snow/50">Positionen</h3>
          <div className="overflow-hidden rounded-2xl border border-snow/[0.08]">
            {doc.items.map((item) =>
              item.kind === "text" ? (
                <p key={item.id} className="border-b border-snow/[0.06] px-4 py-2.5 text-[13px] whitespace-pre-line text-snow/70 last:border-0">
                  {plain(item.description)}
                </p>
              ) : (
                <div key={item.id} className="flex gap-4 border-b border-snow/[0.06] px-4 py-3 last:border-0">
                  <div className="min-w-0 flex-1 text-[13px]">
                    <p className="font-medium whitespace-pre-line">{plain(item.description).split("\n")[0] || item.number || "Position"}</p>
                    {plain(item.description).includes("\n") && (
                      <p className="mt-0.5 whitespace-pre-line text-snow/55">{plain(item.description).split("\n").slice(1).join("\n").trim()}</p>
                    )}
                    <p className="mt-1 text-[12px] text-snow/45 tabular-nums">
                      {quantity(item.quantity)} {item.unit ?? "×"} à {money(item.unit_price_net, doc.currency)} · {quantity(item.vat_percent)} % USt
                      {item.discount ? ` · Rabatt ${item.discount_type === "prozent" ? `${quantity(item.discount)} %` : money(item.discount / 100, doc.currency)}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-[13px] font-medium tabular-nums">{money(item.total_net, doc.currency)}</p>
                </div>
              )
            )}
          </div>
        </section>
      )}

      {plain(doc.closing) && <p className="text-[13px] whitespace-pre-line text-snow/55">{plain(doc.closing)}</p>}

      {doc.kind === "angebot" && doc.source === "intranet" && <SignFolders doc={doc} />}

      {doc.payments.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12px] font-medium text-snow/50">Zahlungen</h3>
          <ul className="divide-y divide-snow/[0.06] rounded-2xl border border-snow/[0.08]">
            {doc.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="tabular-nums text-snow/70">{formatDate(p.paid_on)}</span>
                <span className="min-w-0 flex-1 truncate text-snow/55">{[p.method, p.reference, p.notes].filter(Boolean).join(" · ")}</span>
                <span className="font-medium tabular-nums">{money(p.amount, doc.currency)}</span>
                {doc.source === "intranet" && (
                  <IconButton
                    label="Zahlung entfernen"
                    disabled={removing === p.id}
                    aria-busy={removing === p.id || undefined}
                    onClick={async () => {
                      setRemoving(p.id);
                      try {
                        await removePayment(doc.id, p.id);
                        toast("Zahlung entfernt");
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "Entfernen fehlgeschlagen", "error");
                      }
                      setRemoving(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.related.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12px] font-medium text-snow/50">Verknüpfte Belege</h3>
          <ul className="divide-y divide-snow/[0.06] rounded-2xl border border-snow/[0.08]">
            {doc.related.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-snow/[0.04]">
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{KIND_LABEL[r.kind]}</span> <span className="text-snow/60 tabular-nums">{docLabel(r)}</span>
                  </span>
                  <span className="tabular-nums text-snow/55">{formatDate(r.document_date)}</span>
                  <StatusBadge doc={r} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Amount({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "error" | "success" }) {
  return (
    <div className="rounded-2xl bg-snow/[0.05] px-3 py-2.5">
      <dt className="text-[12px] text-snow/50">{label}</dt>
      <dd className={cn("text-[15px] tabular-nums", strong && "font-medium", tone === "error" && "text-error", tone === "success" && "text-success")}>{value}</dd>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-snow/50">{label}</dt>
      <dd className="mt-0.5 text-snow/85">{children}</dd>
    </div>
  );
}
