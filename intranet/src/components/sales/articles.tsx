"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Package, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { createRow, deleteRow, updateRow, useRows } from "@/lib/data";
import { euro, num } from "@/lib/format";
import { UNITS, type Article, type Retainer } from "@/lib/sales/types";
import { Button, Dialog, Empty, Field, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "./shell";

const unitLabel = (unit: Article["unit"]) => UNITS.find((u) => u.id === unit)?.label ?? unit;

/** Artikel = Dienstleistungen, die GRID verkauft (Preisliste für Angebote
 * und Retainer). */
export function Articles() {
  const { data: articles, loading, error } = useRows<Article>("articles");
  const { data: retainers } = useRows<Retainer>("retainers");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<Article | null | "new">(null);

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of retainers ?? []) if (r.article_id && r.status !== "gekuendigt") map.set(r.article_id, (map.get(r.article_id) ?? 0) + 1);
    return map;
  }, [retainers]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (articles ?? [])
      .filter((a) => showInactive || a.active)
      .filter((a) => !q || [a.name, a.category, a.description].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    const byCategory = new Map<string, Article[]>();
    for (const a of list) {
      const key = a.category || "Ohne Kategorie";
      byCategory.set(key, [...(byCategory.get(key) ?? []), a]);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b, "de"));
  }, [articles, query, showInactive]);

  const activeCount = articles?.filter((a) => a.active).length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Artikel" meta={articles && `${activeCount} aktive Leistungen`}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Artikel durchsuchen" className="h-9 w-32 pl-9 sm:w-40 lg:w-56" />
        </div>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-full px-2 text-[13px] text-snow/70">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-current" />
          <span className="hidden sm:inline">Inaktive zeigen</span>
          <span className="sm:hidden">Inaktive</span>
        </label>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
          <span className="sr-only sm:not-sr-only">Neuer Artikel</span>
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Artikel konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <Empty
          icon={<Package className="h-8 w-8" />}
          title={articles?.length ? "Keine Treffer" : "Noch keine Artikel"}
          text={articles?.length ? undefined : "Lege eure Leistungen mit Preis und Aufwand an. Im Auftragsbuch werden sie als Vorlage für Retainer genutzt."}
          action={!articles?.length && <Button variant="primary" onClick={() => setEditing("new")}>Ersten Artikel anlegen</Button>}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          {groups.map(([category, items]) => (
            <section key={category} className="mb-5 last:mb-0">
              <h2 className="mb-2 px-1 text-[12px] font-medium uppercase tracking-[0.14em] text-snow/45">
                {category} <span className="text-snow/30">· {items.length}</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((a) => (
                  <li key={a.id}>
                    <ArticleCard article={a} usage={usage.get(a.id) ?? 0} onEdit={() => setEditing(a)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ArticleDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        article={editing === "new" ? null : editing}
        categories={[...new Set((articles ?? []).map((a) => a.category).filter(Boolean) as string[])]}
      />
    </div>
  );
}

function ArticleCard({ article, usage, onEdit }: { article: Article; usage: number; onEdit: () => void }) {
  const toast = useToast();
  const [toggling, setToggling] = useState(false);

  async function toggle() {
    setToggling(true);
    try {
      await updateRow<Article>("articles", article.id, { active: !article.active });
    } catch {
      toast("Ändern fehlgeschlagen", "error");
    }
    setToggling(false);
  }

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-snow/[0.06] bg-surface p-4 transition-colors hover:border-snow/15",
        !article.active && "opacity-60"
      )}
    >
      <button type="button" onClick={onEdit} className="flex flex-1 flex-col text-left outline-none focus-visible:underline">
        <h3 className="text-[15px] font-medium">{article.name}</h3>
        {article.description && <p className="mt-1 line-clamp-3 text-[13px] leading-snug text-snow/55">{article.description}</p>}
        <p className="mt-auto pt-4 text-[20px] font-semibold tracking-tight">
          {euro(article.price)} <span className="text-[13px] font-normal text-snow/50">{unitLabel(article.unit)}</span>
        </p>
      </button>
      <div className="mt-3 flex items-center gap-3 border-t border-snow/[0.06] pt-3 text-[12px] text-snow/55">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {num(article.hours)} Std.{article.unit === "monatlich" ? "/Monat" : ""}
        </span>
        {article.hours > 0 && article.price > 0 && (article.unit === "monatlich" || article.unit === "einmalig" || article.unit === "tag") && (
          <span>{euro(article.price / article.hours)}/Std.</span>
        )}
        {usage > 0 && <span>{usage}× im Auftragsbuch</span>}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5" aria-busy={toggling || undefined}>
          <span>{article.active ? "Aktiv" : "Inaktiv"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={article.active}
            aria-label={`${article.name} ${article.active ? "deaktivieren" : "aktivieren"}`}
            disabled={toggling}
            onClick={toggle}
            className={cn(
              "relative h-5 w-9 rounded-full transition-colors disabled:cursor-progress",
              article.active ? "bg-success" : "bg-snow/20"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-sky transition-transform",
                article.active && "translate-x-4"
              )}
            />
          </button>
        </label>
      </div>
    </article>
  );
}

type Form = { name: string; category: string; description: string; price: string; unit: Article["unit"]; hours: string; active: boolean };

function ArticleDialog({
  open,
  onClose,
  article,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  article: Article | null;
  categories: string[];
}) {
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Formular beim Öffnen vorbelegen
    setForm({
      name: article?.name ?? "",
      category: article?.category ?? "",
      description: article?.description ?? "",
      price: article ? String(article.price) : "",
      unit: article?.unit ?? "monatlich",
      hours: article ? String(article.hours) : "",
      active: article?.active ?? true,
    });
    setConfirm(false);
  }, [open, article]);

  if (!form) return null;
  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.name.trim()) return toast("Bitte einen Namen eintragen", "error");
    setBusy("save");
    const values: Partial<Article> = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price.replace(",", ".")) || 0,
      unit: form.unit,
      hours: Number(form.hours.replace(",", ".")) || 0,
      active: form.active,
    };
    try {
      if (article) await updateRow<Article>("articles", article.id, values);
      else await createRow<Article>("articles", values);
      toast(article ? "Artikel gespeichert" : "Artikel angelegt");
      onClose();
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!article) return;
    setBusy("delete");
    try {
      await deleteRow("articles", article.id);
      toast("Artikel gelöscht");
      onClose();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog open={open} onClose={onClose} title={article ? "Artikel bearbeiten" : "Neuer Artikel"}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Name *" className="col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={set("name")} placeholder="z. B. Social Media Betreuung M" />}
        </Field>
        <Field label="Kategorie" className="col-span-2 sm:col-span-1">
          {(id) => (
            <>
              <Input id={id} list="article-categories" value={form.category} onChange={set("category")} placeholder="z. B. Retainer" />
              <datalist id="article-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label="Einheit" className="col-span-2 sm:col-span-1">
          {(id) => (
            <Select id={id} value={form.unit} onChange={set("unit")}>
              {UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Preis (€, netto)">{(id) => <Input id={id} inputMode="decimal" value={form.price} onChange={set("price")} />}</Field>
        <Field label={form.unit === "monatlich" ? "Aufwand (Std. pro Monat)" : "Aufwand (Std.)"}>
          {(id) => <Input id={id} inputMode="decimal" value={form.hours} onChange={set("hours")} />}
        </Field>
        <Field label="Beschreibung / Leistungsumfang" className="col-span-2">
          {(id) => <Textarea id={id} value={form.description} onChange={set("description")} />}
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm text-snow/75">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => f && { ...f, active: e.target.checked })} />
          Aktiv (wird für neue Retainer angeboten)
        </label>
        <div className="col-span-2 flex flex-wrap items-center gap-2 pt-2">
          {article &&
            (confirm ? (
              <Button variant="danger" onClick={remove} loading={busy === "delete"} loadingText="Wird gelöscht …">
                Wirklich löschen
              </Button>
            ) : (
              <Button variant="ghost" className="text-error/80 hover:text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>
                Löschen
              </Button>
            ))}
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" loading={busy === "save"} loadingText="Wird gespeichert …">
            {article ? "Speichern" : "Artikel anlegen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
