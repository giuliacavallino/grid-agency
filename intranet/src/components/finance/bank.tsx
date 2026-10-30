"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ArrowDownLeft, ArrowUpRight, Check, Landmark, Link2, RefreshCw, Search, Unlink, X } from "lucide-react";
import { api } from "@/lib/api";
import { isOpen, maskIban, suggestions, type BankAccount, type BankSync, type BankTransaction, type OpenItem } from "@/lib/bank";
import { mutate, revalidate, useResource, useRows } from "@/lib/data";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import type { Invoice } from "@/lib/sales/types";
import { Badge, Button, Dialog, Empty, Field, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

const STATUS = "/api/finance/bank";
const OPEN_ITEMS = "/api/finance/bank/open-items";
const TX = "/api/sales/bank_transactions";

type Status = { configured: boolean; easybill: boolean; last: BankSync | null };
type OpenItems = { items: OpenItem[]; easybillError: string | null };

const money = (amount: number | null, currency = "EUR") =>
  amount === null ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);

const KIND = {
  invoice: { label: "Eingangsrechnung", color: "#7fa8ff" },
  easybill: { label: "easybill", color: "#9fd8a8" },
} as const;

type Filter = "offen" | "zugeordnet" | "alle";

/** Finance → Bank: Saldo und Umsätze des Firmenkontos (Enable Banking),
 * Abbuchungen ↔ Eingangsrechnungen, Zahlungseingänge ↔ easybill. */
export function Bank() {
  const { data: status, reload: reloadStatus } = useResource<Status>(STATUS);
  const { data: accounts } = useRows<BankAccount>("bank_accounts");
  const { data: transactions, loading, error } = useRows<BankTransaction>("bank_transactions");
  const { data: invoices } = useRows<Invoice>("invoices");
  const { data: open } = useResource<OpenItems>(OPEN_ITEMS);
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("offen");
  const [openId, setOpenId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Rückkehr von der Bank (?verbunden= / ?fehler=) einmal melden
  const reported = useRef(false);
  useEffect(() => {
    const connected = params.get("verbunden");
    const failed = params.get("fehler");
    if (reported.current || (!connected && !failed)) return;
    reported.current = true;
    if (connected) toast(Number(connected) === 1 ? "Konto verbunden" : `${connected} Konten verbunden`);
    else toast(failed!, "error");
    router.replace("/finance/bank");
  }, [params, router, toast]);

  const active = (accounts ?? []).filter((a) => a.active);
  const accountIds = new Set(active.map((a) => a.id));
  const invoiceById = useMemo(() => new Map((invoices ?? []).map((i) => [i.id, i])), [invoices]);
  const items = useMemo(() => open?.items ?? [], [open]);

  const sorted = useMemo(
    () => [...(transactions ?? [])].sort((a, b) => b.booking_date.localeCompare(a.booking_date) || b.amount - a.amount),
    [transactions]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((t) => {
      if (filter === "offen" && !isOpen(t)) return false;
      if (filter === "zugeordnet" && isOpen(t)) return false;
      return !q || [t.counterparty, t.purpose, t.easybill_number, t.note, String(t.amount)].some((v) => v?.toLowerCase().includes(q));
    });
  }, [sorted, filter, query]);
  const openCount = sorted.filter(isOpen).length;
  const balance = active.reduce((sum, a) => sum + (a.balance ?? 0), 0);

  async function sync() {
    setSyncing(true);
    try {
      const r = await api<BankSync>(STATUS, { method: "POST" });
      refresh();
      reloadStatus();
      const matched = r.matched.invoices + r.matched.easybill;
      toast(
        r.errors.length
          ? `Abgleich mit Fehlern: ${r.errors[0]}`
          : `${r.created} neue Umsätze${matched ? `, ${matched} automatisch zugeordnet` : ""}`,
        r.errors.length ? "error" : undefined
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Abgleich fehlgeschlagen", "error");
    }
    setSyncing(false);
  }

  const syncTitle = status?.last ? `Zuletzt abgeglichen: ${formatDateTime(status.last.at)}` : "Noch nie abgeglichen";

  return (
    <div className="flex h-full flex-col">
      <PageBar
        title="Bank"
        meta={
          active.length > 0 && (
            <>
              Saldo {money(balance)} · {openCount} offen
              {status?.last && <> · abgeglichen {relativeTime(status.last.at)}</>}
            </>
          )
        }
      >
        <div className="relative min-w-0 flex-1 md:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Umsätze durchsuchen" className="h-9 w-full pl-9" />
        </div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="h-9 w-auto" aria-label="Filter">
          <option value="offen">Offen</option>
          <option value="zugeordnet">Zugeordnet</option>
          <option value="alle">Alle</option>
        </Select>
        {active.length > 0 && (
          <Button
            size="sm"
            className="h-9 px-2.5 sm:px-3"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={sync}
            loading={syncing}
            loadingText="Wird abgeglichen …"
            disabled={!status?.configured}
            title={syncTitle}
            aria-label="Mit der Bank abgleichen"
          >
            <span className="hidden sm:inline">Abgleichen</span>
          </Button>
        )}
        <Button
          variant={active.length ? "secondary" : "primary"}
          size="sm"
          className="h-9"
          icon={<Link2 className="h-4 w-4" />}
          onClick={() => setConnecting(true)}
          disabled={!status?.configured}
        >
          <span className="sr-only sm:not-sr-only">{active.length ? "Neu verbinden" : "Konto verbinden"}</span>
        </Button>
      </PageBar>

      {status && !status.configured && (
        <p className="border-b border-snow/[0.08] bg-[#e7a33e]/10 px-5 py-2 text-[13px] text-snow/80">
          Enable Banking ist noch nicht eingerichtet: <code>ENABLE_BANKING_APP_ID</code> und <code>ENABLE_BANKING_PRIVATE_KEY</code> in Vercel hinterlegen.
        </p>
      )}
      {open?.easybillError && (
        <p className="border-b border-snow/[0.08] bg-error/10 px-5 py-2 text-[13px] text-snow/80">
          Offene Ausgangsrechnungen konnten nicht aus easybill geladen werden: {open.easybillError}
        </p>
      )}

      {active.length > 0 && (
        <div className="flex shrink-0 gap-3 overflow-x-auto border-b border-snow/[0.08] px-4 py-3 md:px-5">
          {active.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}

      {error ? (
        <Empty title="Umsätze konnten nicht geladen werden" text={error.message} />
      ) : loading || !accounts ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : active.length === 0 && sorted.length === 0 ? (
        <Empty
          icon={<Landmark className="h-8 w-8" />}
          title="Noch kein Konto verbunden"
          text="Verbinde das Commerzbank-Geschäftskonto. Die Bank fragt einmal Login und photoTAN ab, danach holt das Intranet Saldo und Umsätze täglich."
          action={
            status?.configured && (
              <Button variant="primary" icon={<Link2 className="h-4 w-4" />} onClick={() => setConnecting(true)}>
                Konto verbinden
              </Button>
            )
          }
        />
      ) : visible.length === 0 ? (
        <Empty
          icon={<Check className="h-8 w-8" />}
          title={filter === "offen" && !query ? "Alles zugeordnet" : "Keine Treffer"}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul>
            {visible.map((t) => (
              <TransactionRow
                key={t.id}
                tx={t}
                stale={!accountIds.has(t.account_id)}
                invoice={t.invoice_id ? invoiceById.get(t.invoice_id) : undefined}
                suggestion={isOpen(t) ? suggestions(t, items).find((s) => s.amount)?.item : undefined}
                onOpen={() => setOpenId(t.id)}
              />
            ))}
          </ul>
        </div>
      )}

      <TransactionSheet
        tx={sorted.find((t) => t.id === openId)}
        invoice={(() => {
          const t = sorted.find((x) => x.id === openId);
          return t?.invoice_id ? invoiceById.get(t.invoice_id) : undefined;
        })()}
        items={items}
        easybill={!!status?.easybill}
        onClose={() => setOpenId(null)}
      />
      <ConnectDialog open={connecting} onClose={() => setConnecting(false)} />
    </div>
  );
}

function refresh() {
  revalidate("/api/sales/bank_accounts");
  revalidate(TX);
  revalidate("/api/sales/invoices");
  revalidate(OPEN_ITEMS);
}

function AccountCard({ account }: { account: BankAccount }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const days = account.valid_until ? Math.ceil((new Date(account.valid_until).getTime() - now) / 86_400_000) : null;
  const expiring = days !== null && days <= 14;

  async function disconnect() {
    setBusy(true);
    try {
      await api(`/api/finance/bank/accounts/${account.id}`, { method: "DELETE" });
      revalidate("/api/sales/bank_accounts");
      toast("Konto getrennt");
      setConfirm(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Trennen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <div className="min-w-64 shrink-0 rounded-2xl border border-snow/10 bg-surface px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-snow/55">
            {account.aspsp} · {maskIban(account.iban)}
          </p>
          <p className="mt-0.5 text-xl font-medium tabular-nums">{money(account.balance, account.currency)}</p>
        </div>
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="rounded-lg p-1 text-snow/40 hover:bg-snow/[0.08] hover:text-snow"
          aria-label="Konto trennen"
          title="Konto trennen"
        >
          <Unlink className="h-4 w-4" />
        </button>
      </div>
      <p className={clsx("mt-1 text-[12px]", account.error || expiring ? "text-error" : "text-snow/45")}>
        {account.error
          ? account.error
          : days !== null && days < 0
            ? "Freigabe abgelaufen – neu verbinden"
            : expiring
              ? `Freigabe endet in ${days} Tagen – neu verbinden`
              : account.balance_at
                ? `Stand ${formatDateTime(account.balance_at)}`
                : "Noch nicht abgeglichen"}
      </p>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Konto trennen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy} loadingText="Wird getrennt …" onClick={disconnect}>
              Trennen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          Die Freigabe bei der Bank endet, es kommen keine neuen Umsätze mehr. Bisherige Umsätze und Zuordnungen bleiben erhalten.
        </p>
      </Dialog>
    </div>
  );
}

function MatchBadge({ tx, invoice }: { tx: BankTransaction; invoice?: Invoice }) {
  if (tx.match_type === "ignored") return <Badge>Ignoriert</Badge>;
  if (tx.match_type === "easybill") return <Badge color={KIND.easybill.color}>easybill · {tx.easybill_number ?? tx.easybill_document_id}</Badge>;
  if (tx.match_type === "invoice" && tx.invoice_id)
    return <Badge color={KIND.invoice.color}>{invoice ? [invoice.vendor, invoice.invoice_number].filter(Boolean).join(" · ") : "Eingangsrechnung"}</Badge>;
  return null;
}

function TransactionRow({
  tx,
  invoice,
  suggestion,
  stale,
  onOpen,
}: {
  tx: BankTransaction;
  invoice?: Invoice;
  suggestion?: OpenItem;
  stale: boolean;
  onOpen: () => void;
}) {
  const incoming = tx.amount > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={clsx(
          "flex w-full items-center gap-3 border-b border-snow/[0.05] px-4 py-2.5 text-left outline-none hover:bg-snow/[0.04] focus-visible:bg-snow/[0.06] md:px-5",
          stale && "opacity-60"
        )}
      >
        <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full", incoming ? "bg-success/15 text-success" : "bg-snow/[0.06] text-snow/60")}>
          {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{tx.counterparty ?? "Unbekannt"}</span>
          <span className="block truncate text-[12px] text-snow/50">{tx.purpose ?? "–"}</span>
        </span>
        <span className="hidden min-w-0 max-w-64 shrink md:block">
          {isOpen(tx) ? (
            suggestion ? (
              <span className="block truncate text-[12px] text-snow/55">Vorschlag: {[suggestion.name, suggestion.number].filter(Boolean).join(" · ")}</span>
            ) : (
              <span className="text-[12px] text-snow/35">Offen</span>
            )
          ) : (
            <MatchBadge tx={tx} invoice={invoice} />
          )}
        </span>
        <span className="w-28 shrink-0 text-right">
          <span className={clsx("block text-[14px] font-medium tabular-nums", incoming && "text-success")}>{money(tx.amount, tx.currency)}</span>
          <span className="block text-[12px] text-snow/45">{formatDate(tx.booking_date, { day: "2-digit", month: "short" })}</span>
        </span>
      </button>
    </li>
  );
}

function TransactionSheet({
  tx,
  invoice,
  items,
  easybill,
  onClose,
}: {
  tx?: BankTransaction;
  invoice?: Invoice;
  items: OpenItem[];
  easybill: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={!!tx}
      onClose={onClose}
      title={tx ? (tx.counterparty ?? "Umsatz") : "Umsatz"}
      subtitle={tx && `${money(tx.amount, tx.currency)} · gebucht ${formatDate(tx.booking_date)}`}
    >
      {tx && <TransactionDetail key={tx.id} tx={tx} invoice={invoice} items={items} easybill={easybill} />}
    </Sheet>
  );
}

function TransactionDetail({ tx, invoice, items, easybill }: { tx: BankTransaction; invoice?: Invoice; items: OpenItem[]; easybill: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState(tx.note ?? "");
  const incoming = tx.amount > 0;

  const ranked = useMemo(() => suggestions(tx, items), [tx, items]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fitting = items.filter((i) => (incoming ? i.kind === "easybill" : i.kind === "invoice"));
    if (!q) return ranked.slice(0, 6).map((s) => s.item);
    return fitting.filter((i) => [i.name, i.number, String(i.amount)].some((v) => v?.toLowerCase().includes(q))).slice(0, 20);
  }, [query, items, ranked, incoming]);
  const exact = new Set(ranked.filter((s) => s.amount).map((s) => s.item.id));

  async function act(key: string, body: Record<string, unknown>, success: string) {
    setBusy(key);
    try {
      const row = await api<BankTransaction>(`/api/finance/bank/transactions/${tx.id}`, { method: "POST", body: JSON.stringify(body) });
      mutate<BankTransaction[]>(TX, (rows) => rows.map((r) => (r.id === row.id ? row : r)));
      if (body.action !== "note") {
        revalidate("/api/sales/invoices");
        revalidate(OPEN_ITEMS);
      }
      toast(success);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Das hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  const assign = (item: OpenItem) =>
    act(
      item.id,
      item.kind === "invoice" ? { action: "invoice", invoice_id: item.id } : { action: "easybill", document_id: item.id },
      item.kind === "invoice" ? "Eingangsrechnung als bezahlt markiert" : "Zahlung in easybill gebucht"
    );

  return (
    <div className="flex flex-col gap-6 p-5">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-snow/[0.04] p-4 text-[13px]">
        <dt className="text-snow/50">Verwendungszweck</dt>
        <dd className="break-words">{tx.purpose ?? "–"}</dd>
        {tx.counterparty_iban && (
          <>
            <dt className="text-snow/50">IBAN</dt>
            <dd className="font-mono text-[12px]">{tx.counterparty_iban}</dd>
          </>
        )}
        {tx.value_date && tx.value_date !== tx.booking_date && (
          <>
            <dt className="text-snow/50">Wertstellung</dt>
            <dd>{formatDate(tx.value_date)}</dd>
          </>
        )}
        {tx.matched_at && (
          <>
            <dt className="text-snow/50">Zugeordnet</dt>
            <dd>
              {formatDate(tx.matched_at)} · {tx.matched_by}
            </dd>
          </>
        )}
      </dl>

      {!isOpen(tx) ? (
        <div className="flex flex-wrap items-center gap-3">
          <MatchBadge tx={tx} invoice={invoice} />
          {tx.match_type === "easybill" && <span className="text-[12px] text-snow/50">Zahlung ist in easybill gebucht.</span>}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            icon={<X className="h-4 w-4" />}
            onClick={() => act("clear", { action: "clear" }, "Zuordnung gelöst")}
            loading={busy === "clear"}
            loadingText="Wird gelöst …"
          >
            Zuordnung lösen
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center gap-3">
            <p className="flex-1 text-xs font-medium text-snow/60">
              {incoming ? "Ausgangsrechnung (easybill) zuordnen" : "Eingangsrechnung zuordnen"}
            </p>
          </div>
          {incoming && !easybill ? (
            <p className="text-sm text-snow/50">EASYBILL_API_KEY fehlt in Vercel – Zahlungseingänge lassen sich erst danach zuordnen.</p>
          ) : (
            <>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, Nummer oder Betrag" aria-label="Rechnung suchen" className="h-9" />
              <ul className="mt-2 flex flex-col gap-1.5">
                {candidates.length === 0 && <li className="py-3 text-sm text-snow/45">Keine passende offene Rechnung.</li>}
                {candidates.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-snow/10 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{item.name}</p>
                      <p className="truncate text-[12px] text-snow/50">
                        {[item.number && `Nr. ${item.number}`, item.date && formatDate(item.date)].filter(Boolean).join(" · ") || "–"}
                      </p>
                    </div>
                    <span className={clsx("shrink-0 text-[13px] tabular-nums", exact.has(item.id) ? "font-medium text-success" : "text-snow/70")}>
                      {money(item.amount)}
                    </span>
                    <Button size="sm" onClick={() => assign(item)} loading={busy === item.id} loadingText="…" disabled={!!busy && busy !== item.id}>
                      Zuordnen
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={() => act("ignore", { action: "ignore" }, "Als „ohne Rechnung“ markiert")}
            loading={busy === "ignore"}
            loadingText="Wird markiert …"
          >
            Keine Rechnung (z. B. Gehalt, Steuer) – ignorieren
          </Button>
        </div>
      )}

      <Field label="Notiz">
        {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      <div>
        <Button
          variant="primary"
          onClick={() => act("note", { action: "note", note }, "Gespeichert")}
          loading={busy === "note"}
          loadingText="Wird gespeichert …"
          disabled={note.trim() === (tx.note ?? "")}
        >
          Speichern
        </Button>
      </div>
    </div>
  );
}

type Aspsp = { name: string; country: string; psu_types: ("business" | "personal")[] };

function ConnectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: banks, error } = useResource<Aspsp[]>(open ? "/api/finance/bank/banks" : null);
  const toast = useToast();
  const [bank, setBank] = useState("");
  const [psuType, setPsuType] = useState<"business" | "personal">("business");
  const [busy, setBusy] = useState(false);

  const sortedBanks = useMemo(() => [...(banks ?? [])].sort((a, b) => a.name.localeCompare(b.name, "de")), [banks]);
  const selected = bank || sortedBanks.find((b) => /commerzbank/i.test(b.name))?.name || sortedBanks[0]?.name || "";
  const types = sortedBanks.find((b) => b.name === selected)?.psu_types ?? ["business"];
  const type = types.includes(psuType) ? psuType : types[0];

  async function go(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/finance/bank/connect", {
        method: "POST",
        body: JSON.stringify({ aspsp: selected, psu_type: type }),
      });
      window.location.assign(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verbinden fehlgeschlagen", "error");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Bankkonto verbinden">
      {error ? (
        <p className="text-sm text-error">{error.message}</p>
      ) : !banks ? (
        <div className="grid h-24 place-items-center">
          <Spinner />
        </div>
      ) : (
        <form onSubmit={go} className="grid gap-3">
          <Field label="Bank">
            {(id) => (
              <Select id={id} value={selected} onChange={(e) => setBank(e.target.value)}>
                {sortedBanks.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Kontoart" hint="Du wirst zur Bank weitergeleitet (Login und photoTAN). Danach geht es automatisch zurück; das Intranet darf dann Saldo und Umsätze lesen, nichts überweisen.">
            {(id) => (
              <Select id={id} value={type} onChange={(e) => setPsuType(e.target.value as "business" | "personal")}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t === "business" ? "Geschäftskonto" : "Privatkonto"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="primary" type="submit" loading={busy} loadingText="Wird weitergeleitet …" disabled={!selected}>
              Weiter zur Bank
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
