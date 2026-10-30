"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { EMPTY_COMPANY, type Company } from "@/lib/access";
import { api } from "@/lib/api";
import { mutate, useResource } from "@/lib/data";
import { Empty, Field, Input, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

const URL_COMPANY = "/api/admin/company";

const GROUPS: { title: string; fields: { key: keyof Company; label: string; wide?: boolean; placeholder?: string }[] }[] = [
  {
    title: "Unternehmen",
    fields: [
      { key: "name", label: "Firmenname", placeholder: "GRID AGENCY" },
      { key: "legal_form", label: "Rechtsform", placeholder: "UG (haftungsbeschränkt)" },
      { key: "managing_directors", label: "Geschäftsführung", wide: true },
    ],
  },
  {
    title: "Adresse",
    fields: [
      { key: "street", label: "Straße und Nr.", wide: true },
      { key: "zip", label: "PLZ" },
      { key: "city", label: "Ort" },
      { key: "country", label: "Land" },
    ],
  },
  {
    title: "Kontakt",
    fields: [
      { key: "email", label: "E-Mail", placeholder: "hello@grid-agency.de" },
      { key: "phone", label: "Telefon" },
      { key: "website", label: "Website", placeholder: "https://grid-agency.de" },
    ],
  },
  {
    title: "Register und Steuern",
    fields: [
      { key: "register_court", label: "Registergericht" },
      { key: "register_number", label: "Handelsregisternummer", placeholder: "HRB …" },
      { key: "vat_id", label: "USt-IdNr.", placeholder: "DE…" },
      { key: "tax_number", label: "Steuernummer" },
    ],
  },
  {
    title: "Bank",
    fields: [
      { key: "bank", label: "Bank" },
      { key: "iban", label: "IBAN" },
      { key: "bic", label: "BIC" },
    ],
  },
];

/** Admin → Firmendaten: ein Ort für Adresse, Register, Steuer und Bank.
 * Speichert jedes Feld beim Verlassen. */
export function CompanySettings() {
  const company = useResource<Company>(URL_COMPANY);
  return (
    <div className="flex h-full flex-col">
      <PageBar title="Firmendaten" meta="Änderungen werden automatisch gespeichert" />
      {company.error ? (
        <Empty title="Firmendaten konnten nicht geladen werden" text={company.error.message} />
      ) : company.loading || !company.data ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <CompanyForm key="form" company={company.data} />
      )}
    </div>
  );
}

function CompanyForm({ company }: { company: Company }) {
  const toast = useToast();
  const [form, setForm] = useState<Company>({ ...EMPTY_COMPANY, ...company });
  const [saving, setSaving] = useState<keyof Company | null>(null);
  const [saved, setSaved] = useState<keyof Company | null>(null);

  async function save(key: keyof Company) {
    if (form[key].trim() === (company[key] ?? "")) return;
    setSaving(key);
    try {
      const next = await api<Company>(URL_COMPANY, { method: "PUT", body: JSON.stringify({ [key]: form[key] }) });
      mutate<Company>(URL_COMPANY, () => next);
      setSaved(key);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setSaving(null);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-12 md:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 pt-6">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 text-[15px] font-semibold">{group.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.fields.map((field) => (
                <Field key={field.key} label={field.label} className={field.wide ? "sm:col-span-2" : undefined}>
                  {(id) => (
                    <div className="relative">
                      <Input
                        id={id}
                        value={form[field.key]}
                        placeholder={field.placeholder}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, [field.key]: e.target.value }));
                          setSaved(null);
                        }}
                        onBlur={() => save(field.key)}
                        aria-busy={saving === field.key || undefined}
                        className="pr-9"
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2">
                        {saving === field.key ? <Spinner className="h-4 w-4" /> : saved === field.key ? <Check className="h-4 w-4 text-[#30a46c]" /> : null}
                      </span>
                    </div>
                  )}
                </Field>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
