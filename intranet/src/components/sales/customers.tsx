"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Globe, Mail, Pencil, Phone, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { createRow, deleteRow, revalidate, updateRow, useRows } from "@/lib/data";
import { euro, formatDate, num } from "@/lib/format";
import { SOURCES, type Customer, type Lead, type Retainer } from "@/lib/sales/types";
import { Avatar, Badge, Button, Dialog, Empty, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
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

  // Geöffneter Kunde steht in der URL (?id=…), damit Pipeline und Links ihn öffnen
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = params.get("id");
  const open = (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (customers ?? [])
      .filter((c) => !status || c.status === status)
      .filter((c) => !q || [c.name, c.contact_name, c.email, c.city, c.industry].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [customers, query, status]);

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
                <th className="px-5 py-2.5 font-medium">Kunde</th>
                <th className="px-3 py-2.5 font-medium">Ansprechpartner*in</th>
                <th className="px-3 py-2.5 font-medium">E-Mail</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Quelle</th>
                <th className="px-3 py-2.5 text-right font-medium">MRR</th>
                <th className="px-5 py-2.5 font-medium">Kunde seit</th>
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
                  <td className="px-5 py-2.5">
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
          <ul className="divide-y divide-snow/[0.06] md:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => open(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <Avatar name={c.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{c.name}</span>
                    <span className="block truncate text-[12px] text-snow/55">{c.contact_name ?? c.email ?? "–"}</span>
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
      <NewCustomerDialog open={creating} onClose={() => setCreating(false)} onCreated={(c) => open(c.id)} />
    </div>
  );
}

// ---------- Detail ----------

type Form = Record<"name" | "contact_name" | "email" | "phone" | "website" | "industry" | "city" | "status" | "notes", string>;

const toForm = (c: Customer): Form => ({
  name: c.name,
  contact_name: c.contact_name ?? "",
  email: c.email ?? "",
  phone: c.phone ?? "",
  website: c.website ?? "",
  industry: c.industry ?? "",
  city: c.city ?? "",
  status: c.status,
  notes: c.notes ?? "",
});

const fromForm = (f: Form): Partial<Customer> => ({
  name: f.name.trim(),
  contact_name: f.contact_name.trim() || null,
  email: f.email.trim() || null,
  phone: f.phone.trim() || null,
  website: f.website.trim() || null,
  industry: f.industry.trim() || null,
  city: f.city.trim() || null,
  status: f.status as Customer["status"],
  notes: f.notes.trim() || null,
});

function CustomerFields({ form, set }: { form: Form; set: (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Firma / Name *" className="col-span-2 sm:col-span-1">
        {(id) => <Input id={id} value={form.name} onChange={set("name")} />}
      </Field>
      <Field label="Ansprechpartner*in" className="col-span-2 sm:col-span-1">
        {(id) => <Input id={id} value={form.contact_name} onChange={set("contact_name")} />}
      </Field>
      <Field label="E-Mail">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
      <Field label="Telefon">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} />}</Field>
      <Field label="Website">{(id) => <Input id={id} type="url" value={form.website} onChange={set("website")} placeholder="https://" />}</Field>
      <Field label="Status">
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
      <Field label="Branche">{(id) => <Input id={id} value={form.industry} onChange={set("industry")} placeholder="z. B. Gastronomie" />}</Field>
      <Field label="Stadt">{(id) => <Input id={id} value={form.city} onChange={set("city")} />}</Field>
      <Field label="Notizen" className="col-span-2">
        {(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} className="min-h-20" />}
      </Field>
    </div>
  );
}

function CustomerSheet({ id, onClose, retainers }: { id: string | null; onClose: () => void; retainers: Retainer[] | undefined }) {
  const { data: customers, loading } = useRows<Customer>("customers");
  const customer = customers?.find((c) => c.id === id) ?? null;
  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      title={customer?.name ?? "Kunde"}
      subtitle={customer && `Kunde seit ${formatDate(customer.created_at, { month: "long", year: "numeric" })}`}
    >
      {customer ? (
        <CustomerDetail key={customer.id} customer={customer} retainers={retainers?.filter((r) => r.customer_id === customer.id) ?? []} onClose={onClose} />
      ) : loading ? (
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      ) : (
        <Empty title="Kunde nicht gefunden" text="Vielleicht wurde er gelöscht." />
      )}
    </Sheet>
  );
}

function CustomerDetail({ customer, retainers, onClose }: { customer: Customer; retainers: Retainer[]; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(customer));
  const [saving, setSaving] = useState(false);
  const [retainer, setRetainer] = useState<Retainer | null | "new">(null);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(customer));
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const { start, end } = monthRange(0);
  const running = retainers.filter((r) => countsInMonth(r, start, end));
  const mrr = running.reduce((sum, r) => sum + Number(r.monthly_fee), 0);
  const hours = running.reduce((sum, r) => sum + Number(r.hours_per_month), 0);

  async function save() {
    if (!form.name.trim()) return toast("Name fehlt", "error");
    setSaving(true);
    try {
      await updateRow<Customer>("customers", customer.id, fromForm(form));
      toast("Gespeichert");
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

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

      <CustomerFields form={form} set={set} />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={saving} loadingText="Wird gespeichert …" disabled={!dirty}>
          Speichern
        </Button>
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

function NewCustomerDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Customer) => void }) {
  const empty: Form = { name: "", contact_name: "", email: "", phone: "", website: "", industry: "", city: "", status: "aktiv", notes: "" };
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return toast("Bitte einen Namen eintragen", "error");
    setBusy(true);
    try {
      const customer = await createRow<Customer>("customers", { ...fromForm(form), source: "manuell" });
      toast("Kunde angelegt");
      setForm(empty);
      onClose();
      onCreated(customer);
    } catch {
      toast("Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Neuer Kunde">
      <form onSubmit={submit}>
        <CustomerFields form={form} set={set} />
        <div className="flex justify-end gap-2 pt-5">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingText="Wird angelegt …">
            Kunde anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
