"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowUpRight, FileDown, Plus, ReceiptText, Repeat, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useResource } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  KIND_GROUPS,
  KIND_LABEL,
  SERIES_STATUS,
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
import { Badge, Button, Empty, IconButton, Input, Select, Sheet, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { BillingEditor, type EditorKind } from "./billing-editor";
import { DocumentActions, openPdf, removePayment } from "./billing-actions";
import { SignFolders } from "./sign-folder";

const LIST_URL = "/api/finance/ausgang";

/** Umsatzwirksame Belege: Rechnungen abzüglich Gutschriften und Stornos */
const REVENUE_KINDS: BillingKind[] = ["rechnung", "gutschrift", "storno", "storno_gutschrift"];

const kindsOf = (group: KindGroup): readonly BillingKind[] | null =>
  group === "alle" ? null : KIND_GROUPS.find((g) => g.id === group)!.kinds;

const running = (doc: BillingDocument) => doc.recurring?.status === "RUNNING" || doc.recurring?.status === "WAITING";

const invoiceCount = (n: number) => `${n} ${n === 1 ? "Rechnung" : "Rechnungen"}`;

const open = (doc: BillingDocument) => Math.max(0, doc.amount_gross - doc.paid_amount);

/** Ausgangsrechnungen: alle Belege aus easybill (und später aus dem
 * Intranet) mit Ansichten je Belegart, Kennzahlen und Beleg mit PDF. */
export function Billing() {
  const { data: docs, loading, error } = useResource<BillingDocument[]>(LIST_URL);
  const [group, setGroup] = useState<KindGroup>("rechnungen");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ kind: EditorKind; doc: BillingDetail | null } | null>(null);

  // Geöffneter Beleg steht in der URL (?id=…), damit Links ihn öffnen
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = params.get("id");
  const show = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const years = useMemo(
    () => [...new Set((docs ?? []).map((d) => d.document_date?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(),
    [docs]
  );

  const counts = useMemo(() => {
    const map = new Map<KindGroup, number>([["alle", docs?.length ?? 0]]);
    for (const g of KIND_GROUPS) map.set(g.id, (docs ?? []).filter((d) => (g.kinds as readonly string[]).includes(d.kind)).length);
    return map;
  }, [docs]);

  const rows = useMemo(() => {
    const kinds = kindsOf(group);
    const q = query.trim().toLowerCase();
    return (docs ?? []).filter(
      (d) =>
        (!kinds || kinds.includes(d.kind)) &&
        (!status || (status === "ueberfaellig" ? isOverdue(d) : d.status === status)) &&
        (!year || d.document_date?.startsWith(year)) &&
        (!q || [d.number, d.title, d.customer_name].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [docs, group, status, year, query]);

  const stats = useMemo(() => {
    const invoices = (docs ?? []).filter((d) => d.kind === "rechnung" && (d.status === "offen" || d.status === "teilbezahlt"));
    const late = invoices.filter(isOverdue);
    const thisYear = String(new Date().getFullYear());
    const revenue = (docs ?? [])
      .filter((d) => REVENUE_KINDS.includes(d.kind) && d.status !== "entwurf" && d.document_date?.startsWith(thisYear))
      .reduce((sum, d) => sum + d.amount_net, 0);
    return {
      open: invoices.length,
      openSum: invoices.reduce((sum, d) => sum + open(d), 0),
      late: late.length,
      lateSum: late.reduce((sum, d) => sum + open(d), 0),
      revenue,
      thisYear,
      running: (docs ?? []).filter((d) => d.kind === "serie" && running(d)),
    };
  }, [docs]);

  const series = group === "serien";

  return (
    <div className="flex h-full flex-col">
      <PageBar
        title="Ausgangsrechnungen"
        meta={
          docs && (
            <>
              {stats.open} offen · {money(stats.openSum)}
              {stats.late > 0 && <span className="text-error"> · {stats.late} überfällig</span>}
            </>
          )
        }
      >
        <div className="relative min-w-0 flex-1 md:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Belege durchsuchen" className="h-9 w-full pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto" aria-label="Status">
          <option value="">Alle Status</option>
          <option value="ueberfaellig">Überfällig</option>
          {Object.entries(STATUS_LABEL).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="hidden h-9 w-auto sm:block" aria-label="Jahr">
          <option value="">Alle Jahre</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        {series ? (
          <Button variant="primary" size="sm" className="h-9" icon={<Repeat className="h-4 w-4" />} onClick={() => setEditor({ kind: "serie", doc: null })}>
            <span className="sr-only sm:not-sr-only">Neue Serie</span>
          </Button>
        ) : group === "angebote" ? (
          <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ kind: "angebot", doc: null })}>
            <span className="sr-only sm:not-sr-only">Neues Angebot</span>
          </Button>
        ) : (
          <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ kind: "rechnung", doc: null })}>
            <span className="sr-only sm:not-sr-only">Neue Rechnung</span>
          </Button>
        )}
      </PageBar>

      {docs && (
        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-snow/[0.08] bg-snow/[0.08] lg:grid-cols-4">
          <Stat label="Offen" value={money(stats.openSum)} hint={invoiceCount(stats.open)} />
          <Stat
            label="Überfällig"
            value={money(stats.lateSum)}
            hint={invoiceCount(stats.late)}
            tone={stats.late ? "error" : undefined}
            onClick={stats.late ? () => (setGroup("rechnungen"), setStatus("ueberfaellig")) : undefined}
          />
          <Stat label={`Umsatz ${stats.thisYear}`} value={money(stats.revenue)} hint="netto, nach Stornos" />
          <Stat
            label="Laufende Serien"
            value={String(stats.running.length)}
            hint={`${money(stats.running.reduce((sum, d) => sum + d.amount_net, 0))} netto je Lauf`}
          />
        </div>
      )}

      <div role="tablist" aria-label="Belegart" className="flex shrink-0 gap-1 overflow-x-auto border-b border-snow/[0.08] px-3 py-2 md:px-4">
        {[...KIND_GROUPS.map((g) => ({ id: g.id as KindGroup, label: g.label })), { id: "alle" as KindGroup, label: "Alle" }].map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={group === g.id}
            onClick={() => setGroup(g.id)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors",
              group === g.id ? "bg-snow/[0.12] font-medium text-snow" : "text-snow/60 hover:bg-snow/[0.06] hover:text-snow"
            )}
          >
            {g.label}
            <span className="text-[11px] text-snow/45 tabular-nums">{counts.get(g.id) ?? 0}</span>
          </button>
        ))}
      </div>

      {error ? (
        <Empty title="Belege konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty
          icon={<ReceiptText className="h-8 w-8" />}
          title={docs?.length ? "Keine Treffer" : "Noch keine Belege"}
          text={docs?.length ? undefined : "Die easybill-Historie ist noch nicht importiert."}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="hidden w-full text-[13px] md:table">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                <th className="px-5 py-2.5 font-medium">{series ? "Serie" : "Nummer"}</th>
                <th className="px-3 py-2.5 font-medium">Kunde</th>
                <th className="px-3 py-2.5 font-medium">{series ? "Rhythmus" : "Datum"}</th>
                <th className="px-3 py-2.5 font-medium">{series ? "Nächste" : "Fällig"}</th>
                <th className="px-3 py-2.5 text-right font-medium">Netto</th>
                <th className="px-3 py-2.5 text-right font-medium">{series ? "Brutto" : "Offen"}</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => show(d.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && show(d.id)}
                  className="cursor-pointer border-b border-snow/[0.05] outline-none hover:bg-snow/[0.04] focus-visible:bg-snow/[0.06]"
                >
                  <td className="px-5 py-2.5">
                    <span className="block font-medium tabular-nums">{docLabel(d)}</span>
                    {group !== "serien" && kindsOf(group)?.length !== 1 && <span className="block text-[12px] text-snow/45">{KIND_LABEL[d.kind]}</span>}
                  </td>
                  <td className="max-w-64 truncate px-3 py-2.5 text-snow/80">{d.customer_name ?? "–"}</td>
                  <td className="px-3 py-2.5 tabular-nums text-snow/70">{series ? (rhythm(d.recurring) ?? "–") : formatDate(d.document_date)}</td>
                  <td className={cn("px-3 py-2.5 tabular-nums text-snow/70", isOverdue(d) && "text-error")}>
                    {formatDate(series ? d.recurring?.next_date : d.due_date)}
                  </td>
                  <td className={cn("px-3 py-2.5 text-right tabular-nums", d.status === "storniert" && "text-snow/40 line-through")}>
                    {d.amount_net ? money(d.amount_net, d.currency) : "–"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                    {series ? money(d.amount_gross, d.currency) : d.status === "offen" || d.status === "teilbezahlt" ? money(open(d), d.currency) : <span className="text-snow/35">–</span>}
                  </td>
                  <td className="px-5 py-2.5">
                    <StatusBadge doc={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-snow/[0.06] md:hidden">
            {rows.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => show(d.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{d.customer_name ?? "–"}</span>
                    <span className="block truncate text-[12px] text-snow/55">
                      {docLabel(d)} · {series ? rhythm(d.recurring) : formatDate(d.document_date)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-medium tabular-nums">{d.amount_gross ? money(d.amount_gross, d.currency) : "–"}</span>
                    <span className="mt-0.5 block">
                      <StatusBadge doc={d} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "error";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("bg-canvas px-4 py-3 text-left md:px-5", onClick && "hover:bg-snow/[0.04]")}
    >
      <span className="block text-[12px] text-snow/50">{label}</span>
      <span className={cn("block text-[17px] font-medium tabular-nums", tone === "error" && "text-error")}>{value}</span>
      <span className="block text-[12px] text-snow/45">{hint}</span>
    </Tag>
  );
}

function StatusBadge({ doc }: { doc: BillingDocument }) {
  if (doc.kind === "serie") {
    const s = doc.recurring?.status ?? "STOP";
    return (
      <Badge className={cn(s === "STOP" && "text-snow/50")} color={s === "PAUSE" ? "#e7a33e" : s === "STOP" ? undefined : "#9fd8a8"}>
        {SERIES_STATUS[s] ?? s}
      </Badge>
    );
  }
  if (isOverdue(doc)) return <Badge className="bg-error/15 text-error">Überfällig</Badge>;
  const color: Partial<Record<BillingDocument["status"], string>> = {
    offen: "#e7a33e",
    teilbezahlt: "#7fa8ff",
    bezahlt: "#9fd8a8",
    angenommen: "#9fd8a8",
    abgelehnt: "#ec8a84",
  };
  return (
    <Badge color={color[doc.status]} className={cn((doc.status === "storniert" || doc.status === "erledigt") && "text-snow/50")}>
      {STATUS_LABEL[doc.status]}
    </Badge>
  );
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
