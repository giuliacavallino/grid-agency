"use client";

import { useMemo, useState } from "react";
import { AtSign, Download, Globe, Mail, Phone, Plus, Search, Star, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { createRow, deleteRow, revalidate, updateRow, useRows } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { PARTNER_CATEGORIES, PARTNER_KINDS, PARTNER_STATUS, RATE_UNITS, rateText, type Partner, type PartnerKind } from "@/lib/partners";
import { Avatar, Badge, Button, Empty, Field, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { Segmented } from "@/components/sales/pipeline";
import { PageBar } from "@/components/sales/shell";

// Netzwerk: Freelancer (Foto, Video, Schnitt, Grafik …) und Partner
// (Catering, Food, Location …) mit Schwerpunkt, Konditionen und Projekten.
// Export als CSV für Excel.

type KindView = "alle" | PartnerKind;
const KIND_VIEWS = [{ id: "alle", label: "Alle" }, ...PARTNER_KINDS] as { id: KindView; label: string }[];

const URL = "/api/sales/partners";

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-snow/35">–</span>;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} von 5`} title={`${value} von 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= value ? "fill-current text-snow/80" : "text-snow/20")} aria-hidden />
      ))}
    </span>
  );
}

function StatusBadge({ status }: { status: Partner["status"] }) {
  if (status === "aktiv") return null;
  return <Badge className="text-snow/50">{PARTNER_STATUS.find((s) => s.id === status)?.label}</Badge>;
}

/** CSV mit Semikolon und BOM, öffnet sich in Excel direkt richtig */
function exportCsv(rows: Partner[]) {
  const head = ["Art", "Kategorie", "Name", "Firma", "Schwerpunkt", "Konditionen", "Bewertung", "Status", "E-Mail", "Telefon", "Website", "Instagram", "Stadt", "Projekte", "Notizen", "Letzter Kontakt"];
  const cell = (v: unknown) => {
    const text = v == null ? "" : String(v);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = rows.map((p) =>
    [
      PARTNER_KINDS.find((k) => k.id === p.kind)?.label,
      p.category,
      p.name,
      p.company,
      p.focus,
      rateText(p),
      p.rating,
      PARTNER_STATUS.find((s) => s.id === p.status)?.label,
      p.email,
      p.phone,
      p.website,
      p.instagram,
      p.city,
      p.projects,
      p.notes,
      p.last_contact,
    ]
      .map(cell)
      .join(";")
  );
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = `GRID-Netzwerk-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  window.URL.revokeObjectURL(link.href);
}

export function Network() {
  const { data: partners, loading, error } = useRows<Partner>("partners");
  const [kind, setKind] = useState<KindView>("alle");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const categories = useMemo(() => {
    const known = kind === "alle" ? [...PARTNER_CATEGORIES.freelancer, ...PARTNER_CATEGORIES.partner] : PARTNER_CATEGORIES[kind];
    const used = (partners ?? []).filter((p) => kind === "alle" || p.kind === kind).map((p) => p.category);
    return [...new Set([...known, ...used])];
  }, [partners, kind]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (partners ?? [])
      .filter((p) => (kind === "alle" || p.kind === kind) && (!category || p.category === category))
      .filter((p) => !q || [p.name, p.company, p.focus, p.city, p.category, p.projects, p.notes, p.email].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => Number(a.status !== "aktiv") - Number(b.status !== "aktiv") || a.category.localeCompare(b.category, "de") || (a.company || a.name).localeCompare(b.company || b.name, "de"));
  }, [partners, kind, category, query]);

  const count = (k: PartnerKind) => partners?.filter((p) => p.kind === k).length ?? 0;
  const selected = partners?.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Freelancer & Partner" meta={partners && `${count("freelancer")} Freelancer · ${count("partner")} Partner`}>
        <Segmented label="Art" value={kind} onChange={(v) => (setKind(v), setCategory(""))} options={KIND_VIEWS} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto" aria-label="Kategorie">
          <option value="">Alle Kategorien</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Netzwerk durchsuchen" className="h-9 w-32 pl-9 sm:w-40 lg:w-56" />
        </div>
        <Button size="sm" className="h-9" icon={<Download className="h-4 w-4" />} disabled={!rows.length} onClick={() => exportCsv(rows)} title="Aktuelle Auswahl als Excel-Datei (CSV)">
          <span className="sr-only sm:not-sr-only">Excel</span>
        </Button>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          <span className="sr-only sm:not-sr-only">Neu</span>
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Netzwerk konnte nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Empty icon={<Users className="h-8 w-8" />} title={partners?.length ? "Keine Treffer" : "Noch niemand im Netzwerk"} text={partners?.length ? undefined : "Freelancer und Partner mit „Neu“ anlegen."} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="hidden w-full text-[13px] md:table">
            <thead className="sticky top-0 z-10 bg-canvas">
              <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                <th className="py-2.5 pr-3 pl-5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Kategorie</th>
                <th className="px-3 py-2.5 font-medium">Schwerpunkt</th>
                <th className="px-3 py-2.5 font-medium">Konditionen</th>
                <th className="px-3 py-2.5 font-medium">Bewertung</th>
                <th className="px-5 py-2.5 font-medium">Letzter Kontakt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setOpenId(p.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setOpenId(p.id)}
                  className={cn("cursor-pointer border-b border-snow/[0.05] outline-none hover:bg-snow/[0.04] focus-visible:bg-snow/[0.06]", p.status !== "aktiv" && "opacity-60")}
                >
                  <td className="py-2.5 pr-3 pl-5">
                    <span className="flex items-center gap-3">
                      <Avatar name={p.company || p.name} className="h-7 w-7 text-[11px]" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 truncate font-medium">
                          {p.company || p.name} <StatusBadge status={p.status} />
                        </span>
                        <span className="block truncate text-[12px] text-snow/45">{[p.company ? p.name : null, p.city].filter(Boolean).join(" · ") || "–"}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-snow/75">
                    {p.category}
                    <span className="block text-[11.5px] text-snow/40">{PARTNER_KINDS.find((k) => k.id === p.kind)?.label}</span>
                  </td>
                  <td className="max-w-80 px-3 py-2.5 text-snow/70">
                    <span className="line-clamp-2">{p.focus || "–"}</span>
                  </td>
                  <td className="max-w-56 px-3 py-2.5 text-snow/80">
                    <span className="line-clamp-2">{rateText(p) || <span className="text-snow/35">–</span>}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Stars value={p.rating} />
                  </td>
                  <td className="px-5 py-2.5 whitespace-nowrap tabular-nums text-snow/60">{p.last_contact ? formatDate(p.last_contact, { month: "short", year: "numeric" }) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-snow/[0.06] md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpenId(p.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", p.status !== "aktiv" && "opacity-60")}>
                  <Avatar name={p.company || p.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{p.company || p.name}</span>
                    <span className="block truncate text-[12px] text-snow/55">{[p.category, p.focus].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right text-[12.5px] text-snow/75">{rateText({ ...p, rate_note: null }) || "–"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(selected || creating) && (
        <PartnerSheet
          key={selected?.id ?? "neu"}
          partner={selected}
          defaultKind={kind === "alle" ? "freelancer" : kind}
          onClose={() => {
            setOpenId(null);
            setCreating(false);
          }}
          onCreated={(p) => {
            setCreating(false);
            setOpenId(p.id);
          }}
        />
      )}
    </div>
  );
}

// ---------- Anlegen und Bearbeiten ----------

type Form = Record<
  "kind" | "category" | "name" | "company" | "email" | "phone" | "website" | "instagram" | "city" | "focus" | "rate" | "rate_unit" | "rate_note" | "rating" | "status" | "projects" | "notes" | "last_contact",
  string
>;

const toForm = (p: Partner | null, kind: PartnerKind): Form => ({
  kind: p?.kind ?? kind,
  category: p?.category ?? PARTNER_CATEGORIES[kind][0],
  name: p?.name ?? "",
  company: p?.company ?? "",
  email: p?.email ?? "",
  phone: p?.phone ?? "",
  website: p?.website ?? "",
  instagram: p?.instagram ?? "",
  city: p?.city ?? "",
  focus: p?.focus ?? "",
  rate: p?.rate != null ? String(p.rate) : "",
  rate_unit: p?.rate_unit ?? "tag",
  rate_note: p?.rate_note ?? "",
  rating: p?.rating ? String(p.rating) : "",
  status: p?.status ?? "aktiv",
  projects: p?.projects ?? "",
  notes: p?.notes ?? "",
  last_contact: p?.last_contact ?? "",
});

const fromForm = (f: Form): Partial<Partner> => {
  const text = (v: string) => v.trim() || null;
  const rate = f.rate.trim() ? Number(f.rate.replace(/\./g, "").replace(",", ".")) : null;
  return {
    kind: f.kind as PartnerKind,
    category: f.category.trim() || "Sonstiges",
    name: f.name.trim(),
    company: text(f.company),
    email: text(f.email),
    phone: text(f.phone),
    website: text(f.website),
    instagram: text(f.instagram),
    city: text(f.city),
    focus: text(f.focus),
    rate: rate != null && Number.isFinite(rate) ? rate : null,
    rate_unit: rate != null ? (f.rate_unit as Partner["rate_unit"]) : null,
    rate_note: text(f.rate_note),
    rating: f.rating ? Number(f.rating) : null,
    status: f.status as Partner["status"],
    projects: text(f.projects),
    notes: text(f.notes),
    last_contact: f.last_contact || null,
  };
};

const href = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
const instagramUrl = (handle: string) => (/^https?:\/\//.test(handle) ? handle : `https://instagram.com/${handle.replace(/^@/, "")}`);

function PartnerSheet({
  partner,
  defaultKind,
  onClose,
  onCreated,
}: {
  partner: Partner | null;
  defaultKind: PartnerKind;
  onClose: () => void;
  onCreated: (p: Partner) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(partner, defaultKind));
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(partner, defaultKind));
  const categories = [...new Set([...PARTNER_CATEGORIES[form.kind as PartnerKind], form.category])];

  async function save() {
    if (!form.name.trim()) return toast("Bitte einen Namen eintragen", "error");
    setBusy("save");
    try {
      if (partner) {
        await updateRow<Partner>("partners", partner.id, fromForm(form));
        toast("Gespeichert");
      } else {
        const created = await createRow<Partner>("partners", { ...fromForm(form), source: "manuell" });
        toast(`${created.company || created.name} angelegt`);
        onCreated(created);
      }
      revalidate(URL);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!partner) return;
    setBusy("delete");
    try {
      await deleteRow("partners", partner.id);
      revalidate(URL);
      toast(`${partner.company || partner.name} gelöscht`);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
      setBusy(null);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={partner ? partner.company || partner.name : "Neu im Netzwerk"}
      subtitle={partner ? [partner.category, partner.company ? partner.name : null].filter(Boolean).join(" · ") : undefined}
    >
      {partner && (partner.email || partner.phone || partner.website || partner.instagram) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {partner.email && (
            <a href={`mailto:${partner.email}`} className="inline-flex h-9 items-center gap-2 rounded-full border border-snow/12 px-3.5 text-[13px] hover:bg-snow/[0.06]">
              <Mail className="h-4 w-4" /> {partner.email}
            </a>
          )}
          {partner.phone && (
            <a href={`tel:${partner.phone.replace(/\s/g, "")}`} className="inline-flex h-9 items-center gap-2 rounded-full border border-snow/12 px-3.5 text-[13px] hover:bg-snow/[0.06]">
              <Phone className="h-4 w-4" /> {partner.phone}
            </a>
          )}
          {partner.website && (
            <a href={href(partner.website)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-snow/12 px-3.5 text-[13px] hover:bg-snow/[0.06]">
              <Globe className="h-4 w-4" /> Website
            </a>
          )}
          {partner.instagram && (
            <a href={instagramUrl(partner.instagram)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-full border border-snow/12 px-3.5 text-[13px] hover:bg-snow/[0.06]">
              <AtSign className="h-4 w-4" /> {partner.instagram.startsWith("http") ? "Instagram" : partner.instagram}
            </a>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Art">
          {(id) => (
            <Select id={id} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value, category: PARTNER_CATEGORIES[e.target.value as PartnerKind][0] }))}>
              {PARTNER_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Kategorie">
          {(id) => (
            <Select id={id} value={form.category} onChange={set("category")}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Name *">{(id) => <Input id={id} value={form.name} onChange={set("name")} placeholder="Ansprechperson" />}</Field>
        <Field label="Firma / Label">{(id) => <Input id={id} value={form.company} onChange={set("company")} />}</Field>
        <div className="sm:col-span-2">
          <Field label="Schwerpunkt">{(id) => <Textarea id={id} rows={2} value={form.focus} onChange={set("focus")} placeholder="z. B. Food-Reels, Hochzeiten, Produktfotografie mit Studio" />}</Field>
        </div>
        <Field label="Preis (€)">{(id) => <Input id={id} inputMode="decimal" value={form.rate} onChange={set("rate")} placeholder="z. B. 650" />}</Field>
        <Field label="Einheit">
          {(id) => (
            <Select id={id} value={form.rate_unit} onChange={set("rate_unit")}>
              {RATE_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Konditionen">{(id) => <Input id={id} value={form.rate_note} onChange={set("rate_note")} placeholder="z. B. inkl. Schnitt für 3 Reels, Anfahrt extra" />}</Field>
        </div>
        <Field label="E-Mail">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
        <Field label="Telefon">{(id) => <Input id={id} value={form.phone} onChange={set("phone")} />}</Field>
        <Field label="Website">{(id) => <Input id={id} value={form.website} onChange={set("website")} />}</Field>
        <Field label="Instagram">{(id) => <Input id={id} value={form.instagram} onChange={set("instagram")} placeholder="@handle" />}</Field>
        <Field label="Stadt">{(id) => <Input id={id} value={form.city} onChange={set("city")} />}</Field>
        <Field label="Letzter Kontakt">{(id) => <Input id={id} type="date" value={form.last_contact} onChange={set("last_contact")} />}</Field>
        <Field label="Bewertung">
          {(id) => (
            <Select id={id} value={form.rating} onChange={set("rating")}>
              <option value="">–</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={set("status")}>
              {PARTNER_STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Projekte mit GRID">{(id) => <Textarea id={id} rows={2} value={form.projects} onChange={set("projects")} placeholder="z. B. Content Day 480 Gradi (Okt 2026)" />}</Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Notizen">{(id) => <Textarea id={id} rows={3} value={form.notes} onChange={set("notes")} />}</Field>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={busy === "save"} loadingText="Wird gespeichert …" disabled={busy !== null || (!!partner && !dirty)}>
          {partner ? "Speichern" : "Anlegen"}
        </Button>
        {partner &&
          (confirm ? (
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={remove} loading={busy === "delete"} loadingText="Wird gelöscht …" disabled={busy !== null}>
              Wirklich löschen
            </Button>
          ) : (
            <Button variant="ghost" className="text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)} disabled={busy !== null}>
              Löschen
            </Button>
          ))}
      </div>
    </Sheet>
  );
}
