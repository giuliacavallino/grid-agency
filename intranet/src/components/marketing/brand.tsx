"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { COLOR_ROLES, type Brand, type BrandColor, type BrandFont } from "@/lib/marketing";
import { Button, Dialog, Empty, Field, IconButton, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { URL_WORKSPACES, useCurrentWorkspace, WorkspaceSwitcher } from "./workspace";

type BrandResponse = { brand: Brand; brief: string };
type Suggestion = Pick<Brand, "tone" | "audience" | "imagery" | "dos" | "donts" | "hashtags" | "colors" | "fonts">;

const LOGO_VARIANTS = ["Hauptlogo", "Negativ (hell auf dunkel)", "Icon / Bildmarke", "Wortmarke", "Sonstige"];
const brandUrl = (id: string) => `${URL_WORKSPACES}/${id}/brand`;
const toLines = (items: string[]) => items.join("\n");
const fromLines = (text: string) => text.split("\n").map((line) => line.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);

/** Marketing → CI & Vorgaben: Farben, Logos, Schriften, Tonalität, Dos &
 * Don'ts der aktuellen Kundenwelt. Daraus entsteht die Vorgabe für den Agenten. */
export function BrandWorld() {
  const { workspace } = useCurrentWorkspace();
  const data = useResource<BrandResponse>(workspace ? brandUrl(workspace.id) : null);

  if (!workspace) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <PageBar title="CI & Vorgaben" meta={workspace.name}>
        <WorkspaceSwitcher />
      </PageBar>
      {data.error ? (
        <Empty title="CI konnte nicht geladen werden" text={data.error.message} />
      ) : !data.data ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <BrandEditor key={workspace.id} workspaceId={workspace.id} initial={data.data} />
      )}
    </div>
  );
}

function BrandEditor({ workspaceId, initial }: { workspaceId: string; initial: BrandResponse }) {
  const toast = useToast();
  const [brand, setBrand] = useState<Brand>(initial.brand);
  const [brief, setBrief] = useState(initial.brief);
  const [saving, setSaving] = useState(0);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  /** Speichert nur die übergebenen Felder (Autosave) */
  async function save(patch: Partial<Brand>) {
    setSaving((n) => n + 1);
    try {
      const result = await api<BrandResponse>(brandUrl(workspaceId), { method: "PATCH", body: JSON.stringify(patch) });
      setBrief(result.brief);
      mutate<BrandResponse>(brandUrl(workspaceId), () => result);
      if (patch.colors) revalidate(URL_WORKSPACES);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setSaving((n) => n - 1);
  }

  const set = <K extends keyof Brand>(key: K, value: Brand[K]) => setBrand((b) => ({ ...b, [key]: value }));

  async function suggest() {
    setSuggesting(true);
    try {
      setSuggestion(await api<Suggestion>(`${brandUrl(workspaceId)}/suggest`, { method: "POST" }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vorschlag fehlgeschlagen", "error");
    }
    setSuggesting(false);
  }

  /** Vorschlag übernehmen: leere Texte füllen, Listen ergänzen */
  function accept() {
    if (!suggestion) return;
    const merged: Partial<Brand> = {
      tone: brand.tone || suggestion.tone,
      audience: brand.audience || suggestion.audience,
      imagery: brand.imagery || suggestion.imagery,
      dos: [...new Set([...brand.dos, ...suggestion.dos])],
      donts: [...new Set([...brand.donts, ...suggestion.donts])],
      hashtags: [...new Set([...brand.hashtags, ...suggestion.hashtags])],
      colors: [...brand.colors, ...suggestion.colors.filter((c) => !brand.colors.some((x) => x.hex.toLowerCase() === c.hex.toLowerCase()))],
      fonts: [...brand.fonts, ...suggestion.fonts.filter((f) => !brand.fonts.some((x) => x.family === f.family))],
    };
    setBrand((b) => ({ ...b, ...merged }));
    void save(merged);
    setSuggestion(null);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid gap-8 px-4 pt-5 pb-12 md:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid max-w-3xl gap-8">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Website des Kunden" className="min-w-0 flex-1 basis-64">
              {(id) => (
                <Input id={id} value={brand.website ?? ""} onChange={(e) => set("website", e.target.value)} onBlur={() => save({ website: brand.website })} placeholder="https://" />
              )}
            </Field>
            <Button icon={<Sparkles className="h-4 w-4" />} loading={suggesting} loadingText="Claude liest …" onClick={suggest}>
              Mit Claude vorschlagen
            </Button>
            <span className="w-full text-[12px] text-snow/50">
              Claude liest Briefing (Aufgaben) und Website und schlägt Tonalität, Dos & Don&apos;ts, Bildsprache und Hashtags vor. Du prüfst, bevor etwas übernommen wird.
            </span>
          </div>

          <Logos workspaceId={workspaceId} brand={brand} onChange={(logos) => set("logos", logos)} />
          <Colors colors={brand.colors} onChange={(colors) => set("colors", colors)} onSave={(colors) => save({ colors })} />
          <Fonts fonts={brand.fonts} onChange={(fonts) => set("fonts", fonts)} onSave={(fonts) => save({ fonts })} />

          <section className="grid gap-4">
            <h2 className="text-[15px] font-medium">Sprache & Bild</h2>
            <TextBlock label="Tonalität und Ansprache" value={brand.tone} onChange={(v) => set("tone", v)} onSave={(tone) => save({ tone })} placeholder="z. B. herzlich, nahbar, mit Augenzwinkern; wir duzen die Community" />
            <TextBlock label="Zielgruppe" value={brand.audience} onChange={(v) => set("audience", v)} onSave={(audience) => save({ audience })} />
            <TextBlock label="Bildsprache und Gestaltung" value={brand.imagery} onChange={(v) => set("imagery", v)} onSave={(imagery) => save({ imagery })} placeholder="z. B. warmes Tageslicht, echte Menschen, viel Weißraum, Logo unten rechts" />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <ListBlock label="Dos" hint="eine Regel pro Zeile" items={brand.dos} onChange={(v) => set("dos", v)} onSave={(dos) => save({ dos })} />
            <ListBlock label="Don'ts" hint="eine Regel pro Zeile" items={brand.donts} onChange={(v) => set("donts", v)} onSave={(donts) => save({ donts })} />
          </section>

          <ListBlock label="Hashtags" hint="einer pro Zeile" items={brand.hashtags} onChange={(v) => set("hashtags", v)} onSave={(hashtags) => save({ hashtags })} rows={4} />
          <TextBlock label="Weitere Hinweise" value={brand.notes} onChange={(v) => set("notes", v)} onSave={(notes) => save({ notes })} placeholder="Freigaben, Ansprechpartner für Content, Formate, Posting-Rhythmus …" />
          <p className="text-[12px] text-snow/50" aria-live="polite">
            {saving > 0 ? "Wird gespeichert …" : "Änderungen werden automatisch gespeichert"}
          </p>
        </div>

        <AgentBrief brief={brief} />
      </div>
      {suggestion && <SuggestionDialog suggestion={suggestion} onClose={() => setSuggestion(null)} onAccept={accept} />}
    </div>
  );
}

function TextBlock({ label, value, onChange, onSave, placeholder }: { label: string; value: string; onChange: (v: string) => void; onSave: (v: string) => void; placeholder?: string }) {
  const start = useRef(value);
  return (
    <Field label={label}>
      {(id) => (
        <Textarea
          id={id}
          rows={3}
          value={value}
          placeholder={placeholder}
          onFocus={() => (start.current = value)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => value !== start.current && onSave(value)}
        />
      )}
    </Field>
  );
}

function ListBlock({ label, hint, items, onChange, onSave, rows = 8 }: { label: string; hint: string; items: string[]; onChange: (v: string[]) => void; onSave: (v: string[]) => void; rows?: number }) {
  const [text, setText] = useState(toLines(items));
  // Von außen geändert (z. B. Vorschlag übernommen): Text nachziehen
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Liste und Textfeld abgleichen
    setText((current) => (toLines(fromLines(current)) === toLines(items) ? current : toLines(items)));
  }, [items]);
  return (
    <Field label={`${label} (${hint})`}>
      {(id) => (
        <Textarea
          id={id}
          rows={rows}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const next = fromLines(text);
            if (toLines(next) !== toLines(items)) {
              onChange(next);
              onSave(next);
            }
          }}
        />
      )}
    </Field>
  );
}

function Colors({ colors, onChange, onSave }: { colors: BrandColor[]; onChange: (c: BrandColor[]) => void; onSave: (c: BrandColor[]) => void }) {
  const update = (index: number, patch: Partial<BrandColor>, persist = false) => {
    const next = colors.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange(next);
    if (persist) onSave(next);
  };
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-medium">Farben</h2>
        <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...colors, { name: "", hex: "#000000", role: colors.length ? "Akzent" : "Primär" }])}>
          Farbe
        </Button>
      </div>
      {colors.length === 0 && <p className="text-[13px] text-snow/55">Noch keine Farben. Primär und Sekundär färben auch die Kundenwelt im Hub.</p>}
      <ul className="grid gap-2">
        {colors.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <input type="color" value={c.hex} aria-label="Farbe" onChange={(e) => update(i, { hex: e.target.value })} onBlur={() => onSave(colors)} className="h-9 w-11 cursor-pointer rounded-lg border border-snow/15 bg-transparent" />
            <Input value={c.hex} onChange={(e) => update(i, { hex: e.target.value })} onBlur={() => onSave(colors)} aria-label="Hex" className="h-9 w-28 font-mono" />
            <Input value={c.name} onChange={(e) => update(i, { name: e.target.value })} onBlur={() => onSave(colors)} placeholder="Name, z. B. Sonnengelb" aria-label="Name" className="h-9 min-w-0 flex-1 basis-40" />
            <Select value={c.role} onChange={(e) => update(i, { role: e.target.value as BrandColor["role"] }, true)} aria-label="Rolle" className="h-9 w-36">
              {COLOR_ROLES.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </Select>
            <IconButton label="Farbe entfernen" className="h-9 w-9 text-snow/50 hover:text-error" onClick={() => {
                const next = colors.filter((_, x) => x !== i);
                onChange(next);
                onSave(next);
              }}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Fonts({ fonts, onChange, onSave }: { fonts: BrandFont[]; onChange: (f: BrandFont[]) => void; onSave: (f: BrandFont[]) => void }) {
  const update = (index: number, patch: Partial<BrandFont>) => onChange(fonts.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-medium">Typografie</h2>
        <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...fonts, { role: fonts.length ? "Text" : "Headline", family: "" }])}>
          Schrift
        </Button>
      </div>
      {fonts.length === 0 && <p className="text-[13px] text-snow/55">Noch keine Schriften hinterlegt.</p>}
      <ul className="grid gap-2">
        {fonts.map((f, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <Input value={f.role} onChange={(e) => update(i, { role: e.target.value })} onBlur={() => onSave(fonts)} aria-label="Einsatz" placeholder="Headline" className="h-9 w-32" />
            <Input value={f.family} onChange={(e) => update(i, { family: e.target.value })} onBlur={() => onSave(fonts)} aria-label="Schrift" placeholder="z. B. Montserrat Bold" className="h-9 min-w-0 flex-1 basis-40" />
            <Input value={f.notes ?? ""} onChange={(e) => update(i, { notes: e.target.value })} onBlur={() => onSave(fonts)} aria-label="Hinweis" placeholder="Hinweis, z. B. nur Versalien" className="h-9 min-w-0 flex-1 basis-40" />
            <IconButton label="Schrift entfernen" className="h-9 w-9 text-snow/50 hover:text-error" onClick={() => {
                const next = fonts.filter((_, x) => x !== i);
                onChange(next);
                onSave(next);
              }}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Logos({ workspaceId, brand, onChange }: { workspaceId: string; brand: Brand; onChange: (logos: Brand["logos"]) => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [variant, setVariant] = useState(LOGO_VARIANTS[0]);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("variant", variant);
      await api(`${URL_WORKSPACES}/${workspaceId}/logo`, { method: "POST", body: form });
      const fresh = await api<BrandResponse>(brandUrl(workspaceId));
      onChange(fresh.brand.logos);
      mutate<BrandResponse>(brandUrl(workspaceId), () => fresh);
      revalidate(URL_WORKSPACES);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Hochladen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-[15px] font-medium">Logos</h2>
        <Select value={variant} onChange={(e) => setVariant(e.target.value)} aria-label="Variante" className="h-8 w-56">
          {LOGO_VARIANTS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </Select>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }} />
        <Button size="sm" icon={<Upload className="h-4 w-4" />} loading={busy} loadingText="Lädt hoch …" onClick={() => input.current?.click()}>
          Hochladen
        </Button>
      </div>
      {brand.logos.length === 0 ? (
        <p className="text-[13px] text-snow/55">Noch keine Logos. Das Hauptlogo erscheint auch im Hub. PNG, JPG oder WebP bis 2 MB.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {brand.logos.map((logo) => (
            <li key={logo.path} className="w-32">
              {/* Abwechselnd hell/dunkel, damit Negativ-Logos sichtbar sind */}
              <div className={`grid h-24 place-items-center rounded-xl border border-snow/[0.08] p-2 ${logo.variant.startsWith("Negativ") ? "bg-[#141414]" : "bg-white"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Logo aus dem Storage */}
                <img src={logo.url} alt={logo.variant} className="max-h-full max-w-full object-contain" />
              </div>
              <p className="mt-1 truncate text-[12.5px] text-snow/70">{logo.variant}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AgentBrief({ brief }: { brief: string }) {
  const toast = useToast();
  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <div className="rounded-2xl border border-snow/[0.08] bg-panel p-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="flex-1 text-[15px] font-medium">Vorgabe für den Agenten</h2>
          <IconButton
            label="Vorgabe kopieren"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(brief);
                toast("Vorgabe kopiert");
              } catch {
                toast("Kopieren nicht möglich", "error");
              }
            }}
          >
            <Copy className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="mb-3 text-[12px] text-snow/55">So bekommt der Agent die CI (GET …/brand). Er hält sich bei Designs, Texten und Posts daran.</p>
        <pre className="max-h-[60vh] overflow-y-auto text-[12.5px] leading-relaxed whitespace-pre-wrap text-snow/80">{brief}</pre>
      </div>
    </aside>
  );
}

function SuggestionDialog({ suggestion, onClose, onAccept }: { suggestion: Suggestion; onClose: () => void; onAccept: () => void }) {
  const list = (title: string, items: string[]) =>
    items.length ? (
      <div>
        <p className="text-xs font-medium text-snow/60">{title}</p>
        <ul className="mt-1 list-disc pl-5 text-[13.5px]">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Vorschlag von Claude"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Verwerfen
          </Button>
          <Button variant="primary" onClick={onAccept}>
            Übernehmen
          </Button>
        </>
      }
    >
      <div className="grid gap-4 text-[13.5px]">
        <p className="text-[12.5px] text-snow/55">Übernehmen füllt leere Felder und ergänzt die Listen. Bereits Eingetragenes bleibt.</p>
        {[
          ["Tonalität", suggestion.tone],
          ["Zielgruppe", suggestion.audience],
          ["Bildsprache", suggestion.imagery],
        ].map(([title, text]) =>
          text ? (
            <div key={title}>
              <p className="text-xs font-medium text-snow/60">{title}</p>
              <p className="mt-1">{text}</p>
            </div>
          ) : null
        )}
        {list("Dos", suggestion.dos)}
        {list("Don'ts", suggestion.donts)}
        {list("Hashtags", suggestion.hashtags)}
        {list("Farben", suggestion.colors.map((c) => `${c.role}: ${c.name} ${c.hex}`))}
        {list("Schriften", suggestion.fonts.map((f) => `${f.role}: ${f.family}`))}
      </div>
    </Dialog>
  );
}
