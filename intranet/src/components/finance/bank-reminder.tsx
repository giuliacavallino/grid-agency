"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { api } from "@/lib/api";
import type { BankAccount } from "@/lib/bank";
import { useResource } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useIsAdmin } from "@/components/access";
import { Button, useToast } from "@/components/ui";

const WARN_DAYS = 14;

/** Hub: Erinnerung für Admins, wenn die Bank-Freigabe bald abläuft oder
 * abgelaufen ist. „Neu verbinden“ startet Login + photoTAN direkt hier,
 * danach geht es zurück in den Hub. */
export function BankReminder() {
  const admin = useIsAdmin();
  const { data: accounts } = useResource<BankAccount[]>(admin ? "/api/sales/bank_accounts?active=true" : null);
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);

  // Rückkehr von der Bank (?verbunden= / ?fehler=) einmal melden
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("verbunden");
    const failed = params.get("fehler");
    if (!connected && !failed) return;
    toast(connected ? "Bankverbindung erneuert" : failed!, connected ? undefined : "error");
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast]);

  const due = (accounts ?? [])
    .map((a) => ({ account: a, days: a.valid_until ? Math.ceil((new Date(a.valid_until).getTime() - now) / 86_400_000) : null }))
    .filter(({ account, days }) => (days !== null && days <= WARN_DAYS) || /abgelaufen/i.test(account.error ?? ""));
  if (!due.length) return null;

  const { account, days } = due[0];
  const expired = days === null || days < 0;

  async function reconnect() {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/finance/bank/connect", {
        method: "POST",
        body: JSON.stringify({ aspsp: account.aspsp, psu_type: "business", back: "hub" }),
      });
      window.location.assign(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verbinden fehlgeschlagen", "error");
      setBusy(false);
    }
  }

  return (
    <div className={`glass mt-6 flex flex-wrap items-center gap-3 rounded-3xl p-4 ${expired ? "border-error/40" : ""}`} role="status">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-snow/12 bg-snow/10">
        <Landmark className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-medium ${expired ? "text-error" : ""}`}>
          {expired ? `Bankverbindung ${account.aspsp} ist abgelaufen` : `Bankverbindung ${account.aspsp} läuft in ${days} Tagen ab`}
        </p>
        <p className="text-[13px] text-snow/55">
          {expired
            ? "Saldo und Umsätze werden nicht mehr abgeglichen. Einmal mit Login und photoTAN bestätigen."
            : `Gültig bis ${formatDate(account.valid_until)}. Rechtzeitig mit Login und photoTAN verlängern.`}
        </p>
      </div>
      <Button variant="primary" onClick={reconnect} loading={busy} loadingText="Wird weitergeleitet …">
        Neu verbinden
      </Button>
    </div>
  );
}
