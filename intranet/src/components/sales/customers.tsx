"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrow, ArrowRight, ArrowUpNarrowWide, Building2, ChevronDown, ChevronUp, ChevronsUpDown, Globe, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { createRow, deleteRow, revalidate, updateRow, useRows } from "@/lib/data";
import { euro, formatDate, num } from "@/lib/format";
import { SOURCES, type Customer, type Lead, type Retainer } from "@/lib/sales/types";
import { Avatar, Badge, Button, Dialog, Empty, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { CustomerFiles } from "./customer-files";
import { JourFixSection } from "./jourfix";
import { EasybillSync } from "./easybill-sync";
import { PageBar } from "./shell";
import { SourceBadge } from "./source";
import { monthRange, countsInMonth, RetainerDialog, RetainerStatus } from "./orderbook";

export const CUSTOMER_STATUS = [
  { id: "aktiv", label: "Aktiv" },
  { id: "pausiert", label: "Pausiert" },
  { id: "ehemalig", label: "Ehemalig" },
] as const;

const statusLabel = (status: Customer["status"]) => CUSTOMER_STATUS.find((s) => s.id === status)?.label ?? status;

function StatusBadge({ status }: { status: Customer["status"] }) {
  return (
    <Badge className={cn(status === "aktiv" && "bg-success/15 text-success", status === "ehemalig" && "text-snow/50")}>
      {statusLabel(status)}
    </Badge>
  );
}

const isSource = (value: string | null): value is Lead["source"] => SOURCES.some((s) => s.id === value);

function Source({ source }: { source: string | null }) {
  if (!source) return <span className="text-snow/35">–</span>;
  return isSource(source) ? <SourceBadge source={source} /> : <span className="text-snow/70">{source}</span>;
}

const customerNo = (c: Customer) => c.customer_number ?? "–";

type SortKey = "number" | "name" | "contact" | "email" | "status" | "source" | "mrr" | "since";
type Sort = { key: SortKey; dir: 1 | -1 };

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "number", label: "Nr.", className: "pl-5 pr-2 w-20" },
  { key: "name", label: "Kunde", className: "px-3" },
  { key: "contact", label: "Ansprechpartner*in", className: "px-3" },
  { key: "email", label: "E-Mail", className: "px-3" },
  { key: "status", label: "Status", className: "px-3" },
  { key: "source", label: "Quelle", className: "px-3" },
  { key: "mrr", label: "MRR", className: "px-3 text-right" },
  { key: "since", label: "Kunde seit", className: "px-5" },
];

const SORT_STORAGE = "intranet.kunden.sort";

/** Zuletzt gewählte Sortierung (pro Browser); Tabelle rendert erst nach dem Laden der Daten. */
function loadSort(): Sort {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_STORAGE) ?? "null");
    if (COLUMNS.some((c) => c.key === saved?.key) && (saved.dir === 1 || saved.dir === -1)) return saved;
  } catch {}
  return { key: "name", dir: 1 };
}

/** Leere Werte landen immer unten, egal in welche Richtung sortiert wird. */
function compare(a: string | number | null | undefined, b: string | number | null | undefined, dir: 1 | -1) {
  const emptyA = a == null || a === "";
  const emptyB = b == null || b === "";
  if (emptyA || emptyB) return Number(emptyA) - Number(emptyB);
  return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "de", { numeric: true })) * dir;
}

function SortHeader({ column, sort, onSort }: { column: (typeof COLUMNS)[number]; sort: Sort; onSort: (key: SortKey) => void }) {
  const active = sort.key === column.key;
  const Icon = !active ? ChevronsUpDown : sort.dir === 1 ? ChevronUp : ChevronDown;
  return (
    <th aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("py-2.5 font-medium", column.className)}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className={cn("group inline-flex items-center gap-1 hover:text-snow", active && "text-snow/80", column.key === "mrr" && "flex-row-reverse")}
      >
        {column.label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60")} />
      </button>
    </th>
  );
}

/** MRR je Kunde aus den Retainern, die im laufenden Monat zählen. */
function useMrrByCustomer(retainers: Retainer[] | undefined) {
  return useMemo(() => {
    const { start, end } = monthRange(0);
    const map = new Map<string, number>();
    for (const r of retainers ?? []) {
      if (countsInMonth(r, start, end)) map.set(r.customer_id, (map.get(r.customer_id) ?? 0) + Number(r.monthly_fee));
    }
    return map;
  }, [retainers]);
}

export function Customers() {
  const { data: customers, loading, error } = useRows<Customer>("customers");
  const { data: retainers } = useRows<Retainer>("retainers");
  const mrr = useMrrByCustomer(retainers);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [sort, setSortState] = useState<Sort>(loadSort);
  const setSort = (update: (s: Sort) => Sort) =>
    setSortState((s) => {
      const next = update(s);
      try {
        localStorage.setItem(SORT_STORAGE, JSON.stringify(next));
      } catch {}
      return next;
    });
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "mrr" || key === "since" ? -1 : 1 }));

  // Geöffneter Kunde steht in der URL (?id=…), damit Pipeline und Links ihn öffnen
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = params.get("id");
  const open = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (c: Customer) =>
      ({
        number: c.customer_number,
        name: c.name,
        contact: c.contact_name,
        email: c.email,
        status: CUSTOMER_STATUS.findIndex((s) => s.id === c.status),
        source: c.source && (SOURCES.find((s) => s.id === c.source)?.label ?? c.source),
        mrr: mrr.get(c.id),
        since: c.created_at,
      })[sort.key];
    return (customers ?? [])
      .filter((c) => !status || c.status === status)
      .filter((c) => !q || [c.customer_number, c.name, c.contact_name, c.email, c.city, c.industry].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => compare(value(a), value(b), sort.dir) || a.name.localeCompare(b.name, "de"));
  }, [customers, query, status, sort, mrr]);

  const active = customers?.filter((c) => c.status === "aktiv").length ?? 0;
  const totalMrr = [...mrr.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Kunden" meta={customers && `${active} aktiv · ${euro(totalMrr)} MRR`}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Kunden durchsuchen" className="h-9 w-32 pl-9 sm:w-40 lg:w-56" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto" aria-label="Status">
          <option value="">Alle Status</option>
          {CUSTOMER_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <EasybillSync />
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          <span className="sr-only sm:not-sr-only">Neuer Kunde</span>
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Kunden konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty
          icon={<Building2 className="h-8 w-8" />}
          title={customers?.length ? "Keine Treffer" : "Noch keine Kund*innen"}
          text={customers?.length ? undefined : "Gewonnene Leads landen automatisch hier."}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="hidden w-full text-[13px] md:table">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                {COLUMNS.map((column) => (
                  <SortHeader key={column.key} column={column} sort={sort} onSort={toggleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => open(c.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && open(c.id)}
                  className="cursor-pointer border-b border-snow/[0.05] outline-none hover:bg-snow/[0.04] focus-visible:bg-snow/[0.06]"
                >
                  <td className="py-2.5 pr-2 pl-5 tabular-nums text-snow/55">{customerNo(c)}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar name={c.name} className="h-7 w-7 text-[11px]" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        {(c.industry || c.city) && (
                          <span className="block truncate text-[12px] text-snow/45">{[c.industry, c.city].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-snow/80">{c.contact_name ?? "–"}</td>
                  <td className="max-w-56 truncate px-3 py-2.5 text-snow/70">{c.email ?? "–"}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Source source={c.source} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{mrr.get(c.id) ? euro(mrr.get(c.id)) : <span className="text-snow/35">–</span>}</td>
                  <td className="px-5 py-2.5 tabular-nums text-snow/70">{formatDate(c.created_at, { month: "short", year: "numeric" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 border-b border-snow/[0.08] px-4 py-2 md:hidden">
            <span className="text-[12px] text-snow/50">Sortieren</span>
            <Select value={sort.key} onChange={(e) => setSort((s) => ({ key: e.target.value as SortKey, dir: s.dir }))} className="h-8 w-auto text-[13px]" aria-label="Sortieren nach">
              {COLUMNS.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label === "Nr." ? "Kundennummer" : column.label}
                </option>
              ))}
            </Select>
            <IconButton label={sort.dir === 1 ? "Aufsteigend – umkehren" : "Absteigend – umkehren"} onClick={() => setSort((s) => ({ key: s.key, dir: s.dir === 1 ? -1 : 1 }))}>
              {sort.dir === 1 ? <ArrowUpNarrowWide className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
            </IconButton>
          </div>
          <ul className="divide-y divide-snow/[0.06] md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => open(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Avatar name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{c.name}</span>
                    <span className="block truncate text-[12px] text-snow/55">
                      <span className="tabular-nums">{customerNo(c)}</span> · {c.contact_name ?? c.email ?? "–"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-medium tabular-nums">{mrr.get(c.id) ? euro(mrr.get(c.id)) : "–"}</span>
                    <span className="mt-0.5 block">
                      <StatusBadge status={c.status} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CustomerSheet id={openId} onClose={() => open(null)} retainers={retainers} />
      <CustomerDialog open={creating} onClose={() => setCreating(false)} customer={null} customers={customers} onCreated={(c) => open(c.id)} />
    </div>
  );
}

// ---------- Detail ----------

type Form = Record<
  | "customer_number" | "name" | "status" | "industry" | "contact_name" | "email" | "phone" | "website"
  | "street" | "zip" | "city" | "country" | "billing_email" | "vat_id" | "payment_terms_days" | "notes",
  string
>;

const toForm = (c: Customer | null): Form => ({
  customer_number: c?.customer_number ?? "",
  name: c?.name ?? "",
  status: c?.status ?? "aktiv",
  industry: c?.industry ?? "",
  contact_name: c?.contact_name ?? "",
  email: c?.email ?? "",
  phone: c?.phone ?? "",
  website: c?.website ?? "",
  street: c?.street ?? "",
  zip: c?.zip ?? "",
  city: c?.city ?? "",
  country: c?.country ?? "DE",
  billing_email: c?.billing_email ?? "",
  vat_id: c?.vat_id ?? "",
  payment_terms_days: c?.payment_terms_days != null ? String(c.payment_terms_days) : "",
  notes: c?.notes ?? "",
});

function fromForm(f: Form): Partial<Customer> {
  const text = (key: keyof Form) => f[key].trim() || null;
  return {
    customer_number: text("customer_number"),
    name: f.name.trim(),
    status: f.status as Customer["status"],
    industry: text("industry"),
    contact_name: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    street: text("street"),
    zip: text("zip"),
    city: text("city"),
    country: text("country")?.toUpperCase() ?? "DE",
    billing_email: text("billing_email"),
    vat_id: text("vat_id"),
    payment_terms_days: f.payment_terms_days.trim() ? Number(f.payment_terms_days) : null,
    notes: text("notes"),
  };
}

const nextNumber = (customers: Customer[] | undefined) =>
  String(Math.max(0, ...(customers ?? []).map((c) => Number(c.customer_number)).filter(Number.isFinite)) + 1);

function CustomerSheet({ id, onClose, retainers }: { id: string | null; onClose: () => void; retainers: Retainer[] | undefined }) {
  const { data: customers, loading } = useRows<Customer>("customers");
  const customer = customers?.find((c) => c.id === id) ?? null;
  const [editing, setEditing] = useState(false);
  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      title={customer?.name ?? "Kunde"}
      subtitle={
        customer && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular-nums">Nr. {customerNo(customer)}</span>
            <StatusBadge status={customer.status} />
            <span>seit {formatDate(customer.created_at, { month: "long", year: "numeric" })}</span>
          </span>
        )
      }
      actions={
        customer && (
          <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
            Bearbeiten
          </Button>
        )
      }
    >
      {customer ? (
        <CustomerDetail
          key={customer.id}
          customer={customer}
          retainers={retainers?.filter((r) => r.customer_id === customer.id) ?? []}
          onEdit={() => setEditing(true)}
          onClose={onClose}
        />
      ) : loading ? (
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      ) : (
        <Empty title="Kunde nicht gefunden" text="Vielleicht wurde er gelöscht." />
      )}
      {customer && <CustomerDialog key={`bearbeiten-${customer.id}`} open={editing} onClose={() => setEditing(false)} customer={customer} customers={customers} />}
    </Sheet>
  );
}

/** Eine Zeile der Stammdaten; leere Werte als Strich */
function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const empty = children == null || children === "" || children === false;
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] text-snow/45">{label}</dt>
      <dd className={cn("mt-0.5 text-[13px] break-words", empty ? "text-snow/35" : "text-snow/90")}>{empty ? "–" : children}</dd>
    </div>
  );
}

function FactGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-ink/60 px-4 py-3">
      <p className="mb-2.5 text-[11px] font-medium tracking-wide text-snow/55 uppercase">{title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </div>
  );
}

const textLink = "underline decoration-snow/25 underline-offset-2 hover:decoration-snow";

function MasterData({ customer, onEdit }: { customer: Customer; onEdit: () => void }) {
  const address = [customer.street, [customer.zip, customer.city].filter(Boolean).join(" "), customer.country && customer.country !== "DE" ? customer.country : null]
    .filter(Boolean);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-snow/60">Stammdaten</p>
        <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit}>
          Bearbeiten
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <FactGroup title="Kontakt">
          <Fact label="Ansprechpartner*in">{customer.contact_name}</Fact>
          <Fact label="Telefon">{customer.phone && <a href={`tel:${customer.phone}`} className={textLink}>{customer.phone}</a>}</Fact>
          <Fact label="E-Mail">{customer.email && <a href={`mailto:${customer.email}`} className={textLink}>{customer.email}</a>}</Fact>
          <Fact label="Webseite">
            {customer.website && (
              <a href={customer.website} target="_blank" rel="noopener" className={textLink}>
                {customer.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            )}
          </Fact>
        </FactGroup>
        <FactGroup title="Adresse & Rechnung">
          <Fact label="Anschrift">
            {address.length > 0 && (
              <span className="whitespace-pre-line">{address.join("\n")}</span>
            )}
          </Fact>
          <Fact label="Rechnungs-E-Mail">{customer.billing_email ?? (customer.email && <span className="text-snow/45">wie Kontakt-E-Mail</span>)}</Fact>
          <Fact label="USt-IdNr.">{customer.vat_id}</Fact>
          <Fact label="Zahlungsziel">{customer.payment_terms_days != null ? `${customer.payment_terms_days} Tage` : <span className="text-snow/45">Standard</span>}</Fact>
        </FactGroup>
        <FactGroup title="Intern">
          <Fact label="Kundennummer">{customer.customer_number && <span className="tabular-nums">{customer.customer_number}</span>}</Fact>
          <Fact label="Branche">{customer.industry}</Fact>
          <Fact label="Quelle">{customer.source && <Source source={customer.source} />}</Fact>
          <Fact label="Status">
            <StatusBadge status={customer.status} />
          </Fact>
          {customer.notes && (
            <Fact label="Notizen" className="col-span-2">
              <span className="whitespace-pre-line">{customer.notes}</span>
            </Fact>
          )}
        </FactGroup>
      </div>
    </section>
  );
}

function CustomerDetail({ customer, retainers, onEdit, onClose }: { customer: Customer; retainers: Retainer[]; onEdit: () => void; onClose: () => void }) {
  const toast = useToast();
  const [retainer, setRetainer] = useState<Retainer | null | "new">(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { start, end } = monthRange(0);
  const running = retainers.filter((r) => countsInMonth(r, start, end));
  const mrr = running.reduce((sum, r) => sum + Number(r.monthly_fee), 0);
  const hours = running.reduce((sum, r) => sum + Number(r.hours_per_month), 0);

  async function remove() {
    setDeleting(true);
    try {
      await deleteRow("customers", customer.id);
      // Retainer werden in der Datenbank mitgelöscht
      revalidate("/api/sales/retainers");
      toast("Kunde gelöscht");
      setConfirm(false);
      onClose();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
      setDeleting(false);
    }
  }

  const link = "inline-flex h-10 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 text-sm font-medium hover:bg-snow/12";

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          ["MRR", euro(mrr)],
          ["Std./Monat", num(hours)],
          ["Retainer", String(running.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-ink/60 px-3 py-2.5">
            <p className="text-[11px] text-snow/50">{label}</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {(customer.email || customer.phone || customer.website) && (
        <div className="flex flex-wrap items-center gap-2">
          {customer.email && (
            <Link href={`/sales/posteingang?to=${encodeURIComponent(customer.email)}`} className={link}>
              <Mail className="h-4 w-4" /> Mail schreiben
            </Link>
          )}
          {customer.phone && (
            <a href={`tel:${customer.phone}`} className={link}>
              <Phone className="h-4 w-4" /> Anrufen
            </a>
          )}
          {customer.website && (
            <a href={customer.website} target="_blank" rel="noopener" className={link}>
              <Globe className="h-4 w-4" /> Website
            </a>
          )}
        </div>
      )}

      <MasterData customer={customer} onEdit={onEdit} />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-snow/60">Retainer</p>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setRetainer("new")}>
            Retainer
          </Button>
        </div>
        {retainers.length === 0 ? (
          <p className="rounded-2xl bg-ink/60 px-4 py-5 text-center text-sm text-snow/45">Noch kein Retainer im Auftragsbuch.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {retainers.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-ink/60 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="text-[12px] text-snow/50">
                    {formatDate(r.start_date)} – {r.end_date ? formatDate(r.end_date) : "unbefristet"} · {num(r.hours_per_month)} Std.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{euro(r.monthly_fee)}</p>
                  <RetainerStatus status={r.status} />
                </div>
                <IconButton label="Retainer bearbeiten" onClick={() => setRetainer(r)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <JourFixSection customer={customer} />

      <CustomerFiles customer={customer} />

      {customer.lead_id && (
        <Link href="/sales" className="inline-flex items-center gap-2 text-sm text-snow/70 hover:text-snow">
          Aus Lead gewonnen
          {customer.source && <Source source={customer.source} />}
          <ArrowRight className="h-3.5 w-3.5" /> Pipeline
        </Link>
      )}

      <div className="border-t border-snow/10 pt-5">
        <Button variant="ghost" className="text-error/80 hover:text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>
          Kunde löschen
        </Button>
      </div>

      <RetainerDialog open={retainer !== null} onClose={() => setRetainer(null)} retainer={retainer === "new" ? null : retainer} customerId={customer.id} />
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Kunde löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={remove} loading={deleting} loadingText="Wird gelöscht …">
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          {customer.name} wird mit {retainers.length === 1 ? "einem Retainer" : `${retainers.length} Retainern`} gelöscht. Das ändert auch den MRR-Verlauf. Für beendete Zusammenarbeit besser den Status „Ehemalig“ setzen.
        </p>
      </Dialog>
    </div>
  );
}

function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      <legend className="mb-3 text-[11px] font-medium tracking-wide text-snow/55 uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

/** Stammdaten anlegen (customer = null) oder bearbeiten, gruppiert im Popup. */
function CustomerDialog({
  open,
  onClose,
  customer,
  customers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
  customers: Customer[] | undefined;
  onCreated?: (c: Customer) => void;
}) {
  const formId = useId();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(customer));
  const [busy, setBusy] = useState(false);
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Beim Öffnen immer mit dem aktuellen Stand beginnen
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(toForm(customer));
  }

  const number = form.customer_number.trim();
  const taken = !!number && !!customers?.some((c) => c.id !== customer?.id && c.customer_number === number);
  const numberMissing = !!customer && !number;
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(customer));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return toast("Bitte einen Namen eintragen", "error");
    if (taken || numberMissing) return;
    setBusy(true);
    try {
      if (customer) {
        await updateRow<Customer>("customers", customer.id, fromForm(form));
        toast("Gespeichert");
        onClose();
      } else {
        const created = await createRow<Customer>("customers", { ...fromForm(form), source: "manuell" });
        toast(`Kunde ${created.customer_number ?? ""} angelegt`.replace("  ", " "));
        onClose();
        onCreated?.(created);
      }
    } catch (error) {
      toast(error instanceof ApiError && error.status < 500 ? error.message : customer ? "Speichern fehlgeschlagen" : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={customer ? "Stammdaten bearbeiten" : "Neuer Kunde"}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={busy}
            loadingText={customer ? "Wird gespeichert …" : "Wird angelegt …"}
            disabled={taken || numberMissing || (!!customer && !dirty)}
          >
            {customer ? "Speichern" : "Kunde anlegen"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-6 pt-1">
        <FormGroup title="Allgemein">
          <Field label="Kundennr." className="col-span-1 sm:col-span-2">
            {(id) => (
              <>
                <Input
                  id={id}
                  value={form.customer_number}
                  title={customer ? undefined : "Leer lassen für die nächste freie Nummer"}
                  onChange={set("customer_number")}
                  placeholder={customer ? undefined : `${nextNumber(customers)} (automatisch)`}
                  inputMode="numeric"
                  aria-invalid={taken || numberMissing || undefined}
                  className={cn("tabular-nums", (taken || numberMissing) && "border-error/60")}
                />
                {taken && <p className="text-xs text-error">Schon vergeben</p>}
                {numberMissing && <p className="text-xs text-error">Pflichtfeld</p>}
              </>
            )}
          </Field>
          <Field label="Status" className="col-span-1 sm:col-span-2">
            {(id) => (
              <Select id={id} value={form.status} onChange={set("status")}>
                {CUSTOMER_STATUS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Branche" className="col-span-2">
            {(id) => <Input id={id} value={form.industry} onChange={set("industry")} placeholder="z. B. Gastronomie" />}
          </Field>
          <Field label="Firma / Name *" className="col-span-2 sm:col-span-6">
            {(id) => <Input id={id} value={form.name} onChange={set("name")} autoFocus={!customer} />}
          </Field>
        </FormGroup>

        <FormGroup title="Kontakt">
          <Field label="Ansprechpartner*in" className="col-span-2 sm:col-span-3">
            {(id) => <Input id={id} value={form.contact_name} onChange={set("contact_name")} />}
          </Field>
          <Field label="Telefon" className="col-span-2 sm:col-span-3">
            {(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} />}
          </Field>
          <Field label="E-Mail" className="col-span-2 sm:col-span-3">
            {(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}
          </Field>
          <Field label="Webseite" className="col-span-2 sm:col-span-3">
            {(id) => <Input id={id} type="url" value={form.website} onChange={set("website")} placeholder="https://" />}
          </Field>
        </FormGroup>

        <FormGroup title="Adresse">
          <Field label="Straße und Hausnummer" className="col-span-2 sm:col-span-6">
            {(id) => <Input id={id} value={form.street} onChange={set("street")} autoComplete="street-address" />}
          </Field>
          <Field label="PLZ" className="col-span-1 sm:col-span-1">
            {(id) => <Input id={id} value={form.zip} onChange={set("zip")} inputMode="numeric" autoComplete="postal-code" />}
          </Field>
          <Field label="Stadt" className="col-span-1 sm:col-span-4">
            {(id) => <Input id={id} value={form.city} onChange={set("city")} />}
          </Field>
          <Field label="Land" className="col-span-2 sm:col-span-1">
            {(id) => <Input id={id} value={form.country} onChange={set("country")} maxLength={2} className="uppercase" placeholder="DE" />}
          </Field>
        </FormGroup>

        <FormGroup title="Rechnung">
          <Field label="Rechnungs-E-Mail" className="col-span-2 sm:col-span-3">
            {(id) => <Input id={id} type="email" value={form.billing_email} onChange={set("billing_email")} />}
          </Field>
          <Field label="USt-IdNr." className="col-span-1 sm:col-span-2">
            {(id) => <Input id={id} value={form.vat_id} onChange={set("vat_id")} placeholder="DE…" />}
          </Field>
          <Field label="Zahlungsziel" className="col-span-1 sm:col-span-1">
            {(id) => <Input id={id} type="number" min={0} value={form.payment_terms_days} onChange={set("payment_terms_days")} placeholder="Tage" className="tabular-nums" />}
          </Field>
        </FormGroup>

        <Field label="Notizen">{(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} className="min-h-20" />}</Field>
      </form>
    </Dialog>
  );
}
