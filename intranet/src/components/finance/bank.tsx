"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Check, Eye, EyeOff, Landmark, Link2, RefreshCw, Unlink, X } from "lucide-react";
import { api } from "@/lib/api";
import { isOpen, suggestions, type BankAccount, type BankSync, type BankTransaction, type OpenItem } from "@/lib/bank";
import { mutate, revalidate, useResource, useRows } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Invoice } from "@/lib/sales/types";
import { Badge, Button, Dialog, Empty, Field, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { accentFill } from "@/lib/theme";
import { Card, Page, PageHead, SearchPill, Segmented, pillButton, rowClass, tdClass, thClass } from "./kit";

const STATUS = "/api/finance/bank";
const OPEN_ITEMS = "/api/finance/bank/open-items";
const TX = "/api/sales/bank_transactions";

type Status = { configured: boolean; last: BankSync | null };
type OpenItems = { items: OpenItem[]; receivablesError: string | null };

const money = (amount: number | null, currency = "EUR") =>
  amount === null ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);

const KIND = {
  invoice: { label: "Eingangsrechnung", color: "#7fa8ff" },
  receivable: { label: "Ausgangsrechnung", color: "#9fd8a8" },
} as const;

type Filter = "offen" | "zugeordnet" | "alle";

/** Finance → Bank: Saldo und Umsätze des Firmenkontos (Enable Banking),
 * Abbuchungen ↔ Eingangsrechnungen, Zahlungseingänge ↔ Ausgangsrechnungen. */
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
      return !q || [t.counterparty, t.purpose, t.billing_number, t.note, String(t.amount), money(t.amount, t.currency)].some((v) => v?.toLowerCase().includes(q));
    });
  }, [sorted, filter, query]);
  const openCount = sorted.filter(isOpen).length;

  async function sync() {
    setSyncing(true);
    try {
      const r = await api<BankSync>(STATUS, { method: "POST" });
      refresh();
      reloadStatus();
      const matched = r.matched.invoices + r.matched.receivables;
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
    <Page>
      <PageHead
        title="Bank"
        meta={
          active.length > 0 ? (
            <span className="flex flex-col gap-1">
              {active.map((account) => (
                <AccountLine key={account.id} account={account} />
              ))}
            </span>
          ) : (
            "Firmenkonto über Enable Banking"
          )
        }
      >
        <Button
          variant={active.length ? "ghost" : "primary"}
          icon={<Link2 className="h-4 w-4" />}
          onClick={() => setConnecting(true)}
          disabled={!status?.configured}
        >
          {active.length ? "Neu verbinden" : "Konto verbinden"}
        </Button>
      </PageHead>

      {status && !status.configured && (
        <p className="rounded-2xl px-4 py-2.5 text-[13px] text-snow/80" style={{ background: accentFill("#e7a33e", 14) }}>
          Enable Banking ist noch nicht eingerichtet: <code>ENABLE_BANKING_APP_ID</code> und <code>ENABLE_BANKING_PRIVATE_KEY</code> in Vercel hinterlegen.
        </p>
      )}
      {open?.receivablesError && (
        <p className="rounded-2xl bg-error/10 px-4 py-2.5 text-[13px] text-snow/80">Offene Ausgangsrechnungen konnten nicht geladen werden: {open.receivablesError}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { id: "offen", label: "Zu tun", count: openCount },
            { id: "zugeordnet", label: "Erledigt" },
            { id: "alle", label: "Alle" },
          ]}
        />
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          <SearchPill value={query} onChange={setQuery} placeholder="Name, Zweck, Betrag …" label="Umsätze durchsuchen" className="w-full sm:w-72" />
          {active.length > 0 && (
            <Button
              className={pillButton}
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={sync}
              loading={syncing}
              loadingText="Wird abgerufen …"
              disabled={!status?.configured}
              title={syncTitle}
            >
              Jetzt abrufen
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <Empty title="Umsätze konnten nicht geladen werden" text={error.message} />
        ) : loading || !accounts ? (
          <div className="grid h-60 place-items-center">
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
          <Empty icon={<Check className="h-8 w-8" />} title={filter === "offen" && !query ? "Alles zugeordnet" : "Keine Treffer"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed text-[13.5px]">
              <colgroup>
                <col className="w-32" />
                <col />
                <col className="w-40" />
                <col className="w-[30%]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={thClass}>Datum ↓</th>
                  <th className={thClass}>Gegenpartei · Verwendungszweck</th>
                  <th className={clsx(thClass, "text-right")}>Betrag</th>
                  <th className={thClass}>Zuordnung</th>
                </tr>
              </thead>
              <tbody>
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
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TransactionSheet
        tx={sorted.find((t) => t.id === openId)}
        invoice={(() => {
          const t = sorted.find((x) => x.id === openId);
          return t?.invoice_id ? invoiceById.get(t.invoice_id) : undefined;
        })()}
        items={items}
        onClose={() => setOpenId(null)}
      />
      <ConnectDialog open={connecting} onClose={() => setConnecting(false)} />
    </Page>
  );
}

function refresh() {
  revalidate("/api/sales/bank_accounts");
  revalidate(TX);
  revalidate("/api/sales/invoices");
  revalidate(OPEN_ITEMS);
}

/** IBAN fast ganz verdeckt: DE•• •••• •••• 8000 */
const hideIban = (iban: string | null) => (iban ? `${iban.slice(0, 2)}•• •••• •••• ${iban.replace(/\s/g, "").slice(-4)}` : null);

/** „Di 03.11.26 · 10:04“ */
function stamp(value: string) {
  const d = new Date(value);
  const day = d.toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
  const date = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${date} · ${time}`;
}

/** Konto in einer Zeile: Bank · IBAN · Saldo (verdeckt, Auge zeigt ihn) · Stand */
function AccountLine({ account }: { account: BankAccount }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [now] = useState(() => Date.now());
  const days = account.valid_until ? Math.ceil((new Date(account.valid_until).getTime() - now) / 86_400_000) : null;
  const expiring = days !== null && days <= 14;
  const warning = account.error
    ? account.error
    : days !== null && days < 0
      ? "Freigabe abgelaufen – neu verbinden"
      : expiring
        ? `Freigabe endet in ${days} Tagen – neu verbinden`
        : null;

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

  const Eye_ = reveal ? EyeOff : Eye;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
      <span className="font-medium text-snow/80">{account.aspsp}</span>
      {hideIban(account.iban) && (
        <>
          <span aria-hidden>·</span>
          <span className="tracking-wide tabular-nums">{hideIban(account.iban)}</span>
        </>
      )}
      <span aria-hidden>·</span>
      <span className={clsx("font-semibold text-snow tabular-nums transition-[filter]", !reveal && "blur-[5px] select-none")} aria-hidden={!reveal}>
        {money(account.balance, account.currency)}
      </span>
      {!reveal && <span className="sr-only">Saldo verdeckt</span>}
      <button
        type="button"
        onClick={() => setReveal((r) => !r)}
        aria-label={reveal ? "Saldo verbergen" : "Saldo zeigen"}
        aria-pressed={reveal}
        title={reveal ? "Saldo verbergen" : "Saldo zeigen"}
        className="-m-1 rounded-full p-1 text-snow/45 hover:bg-snow/[0.06] hover:text-snow"
      >
        <Eye_ className="h-4 w-4" />
      </button>
      {account.balance_at && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{stamp(account.balance_at)}</span>
        </>
      )}
      {warning && <span className="font-medium text-error">· {warning}</span>}
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="-m-1 rounded-full p-1 text-snow/35 hover:bg-snow/[0.06] hover:text-snow"
        aria-label="Konto trennen"
        title="Konto trennen"
      >
        <Unlink className="h-3.5 w-3.5" />
      </button>

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
    </span>
  );
}

function MatchBadge({ tx, invoice }: { tx: BankTransaction; invoice?: Invoice }) {
  if (tx.match_type === "ignored") return <Badge>Ignoriert</Badge>;
  if (tx.match_type === "receivable") return <Badge color={KIND.receivable.color}>Ausgangsrechnung · {tx.billing_number ?? "ohne Nr."}</Badge>;
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
    <tr onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()} tabIndex={0} className={clsx(rowClass, stale && "opacity-60")}>
      <td className={clsx(tdClass, "whitespace-nowrap text-snow/70 tabular-nums")}>{formatDate(tx.booking_date)}</td>
      <td className={clsx(tdClass, "min-w-0")}>
        <span className="block truncate font-semibold">{tx.counterparty ?? "Unbekannt"}</span>
        <span className="block truncate text-[12.5px] text-snow/50">{tx.purpose ?? "–"}</span>
      </td>
      <td className={clsx(tdClass, "text-right font-semibold whitespace-nowrap tabular-nums", !incoming && "text-error")}>{money(tx.amount, tx.currency)}</td>
      <td className={clsx(tdClass, "min-w-0")}>
        {isOpen(tx) ? (
          suggestion ? (
            <span className="block truncate text-[12.5px] text-snow/55">Vorschlag: {[suggestion.name, suggestion.number].filter(Boolean).join(" · ")}</span>
          ) : (
            <span className="text-snow/30">–</span>
          )
        ) : (
          <span className="block truncate">
            <MatchBadge tx={tx} invoice={invoice} />
          </span>
        )}
      </td>
    </tr>
  );
}

function TransactionSheet({
  tx,
  invoice,
  items,
  onClose,
}: {
  tx?: BankTransaction;
  invoice?: Invoice;
  items: OpenItem[];
  onClose: () => void;
}) {
  return (
    <Sheet
      open={!!tx}
      onClose={onClose}
      title={tx ? (tx.counterparty ?? "Umsatz") : "Umsatz"}
      subtitle={tx && `${money(tx.amount, tx.currency)} · gebucht ${formatDate(tx.booking_date)}`}
    >
      {tx && <TransactionDetail key={tx.id} tx={tx} invoice={invoice} items={items} />}
    </Sheet>
  );
}

function TransactionDetail({ tx, invoice, items }: { tx: BankTransaction; invoice?: Invoice; items: OpenItem[] }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState(tx.note ?? "");
  const incoming = tx.amount > 0;

  const ranked = useMemo(() => suggestions(tx, items), [tx, items]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fitting = items.filter((i) => (incoming ? i.kind === "receivable" : i.kind === "invoice"));
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
      item.kind === "invoice" ? { action: "invoice", invoice_id: item.id } : { action: "receivable", document_id: item.id },
      item.kind === "invoice" ? "Eingangsrechnung als bezahlt markiert" : "Zahlung bei der Ausgangsrechnung gebucht"
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
              {incoming ? "Ausgangsrechnung zuordnen" : "Eingangsrechnung zuordnen"}
            </p>
          </div>
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
