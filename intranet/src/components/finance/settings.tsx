"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FINANCE_MAILBOX } from "@/lib/config";
import { mutate, useResource } from "@/lib/data";
import type { Settings } from "@/lib/sales/types";
import { Button, Field, Input, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

/** Einstellungen für Finance: DATEV-Upload-Adresse (Belegtransfer per Mail). */
export function FinanceSettings() {
  const { data } = useResource<Settings>("/api/sales/settings");
  return (
    <div className="flex h-full flex-col">
      <PageBar title="Einstellungen" />
      <div className="overflow-y-auto p-5">
        {data ? <DatevForm key={data.datev.upload_address} initial={data.datev.upload_address} /> : <Spinner />}
      </div>
    </div>
  );
}

function DatevForm({ initial }: { initial: string }) {
  const toast = useToast();
  const [address, setAddress] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<Settings>("/api/sales/settings", {
        method: "PUT",
        body: JSON.stringify({ datev: { upload_address: address } }),
      });
      mutate<Settings>("/api/sales/settings", () => result);
      toast("Gespeichert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="max-w-lg rounded-3xl border border-snow/10 bg-surface p-6">
      <h2 className="mb-1 text-lg font-medium">DATEV Upload-Mail</h2>
      <p className="mb-5 text-sm text-snow/60">
        Freigegebene Eingangsrechnungen gehen mit ihren Belegen von {FINANCE_MAILBOX} an diese Adresse. Sie steht in DATEV
        Unternehmen online unter „Belegtransfer per E-Mail“.
      </p>
      <Field label="Upload-Adresse">
        {(id) => (
          <Input
            id={id}
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="…@uploadmail.datev.de"
          />
        )}
      </Field>
      <Button type="submit" variant="primary" className="mt-5" loading={busy} loadingText="Wird gespeichert …" disabled={address.trim() === initial}>
        Speichern
      </Button>
    </form>
  );
}
