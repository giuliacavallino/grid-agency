"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Contrast, Copy, Download, ImagePlus, Images, ListChecks, MessageSquareQuote, Palette, Plus, Shapes, Sparkles, Star, Trash2, Type, Upload, X } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { ASSET_KINDS, COLOR_ROLES, type Brand, type BrandAsset, type BrandColor, type BrandFont } from "@/lib/marketing";
import { Button, Dialog, Empty, Field, IconButton, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { AkteHeader } from "@/components/akte/header";
import { useMarketingStatus } from "./common";
import { URL_WORKSPACES, useCurrentWorkspace } from "./workspace";

type BrandResponse = { brand: Brand; brief: string };
type Suggestion = Pick<Brand, "tone" | "audience" | "imagery" | "dos" | "donts" | "hashtags" | "colors" | "fonts">;

const LOGO_VARIANTS = ["Hauptlogo", "Negativ (hell auf dunkel)", "Icon / Bildmarke", "Wortmarke", "Sonstige"];
const brandUrl = (id: string) => `${URL_WORKSPACES}/${id}/brand`;

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
      <AkteHeader title="Markenkit" meta="Logos, Farben, Schriften, Markenstimme und Regeln – verbindliche Vorgabe für Team und Agent" />
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

// ---------- Markenkit (Aufbau wie ein Brand Kit: Logos, Farben, Schriften,
// Markenstimme, Bildmaterial, Regeln) ----------

const SECTIONS = [
  { id: "logos", label: "Logos", icon: Shapes },
  { id: "farben", label: "Farben", icon: Palette },
  { id: "schriften", label: "Schriften", icon: Type },
  { id: "stimme", label: "Markenstimme", icon: MessageSquareQuote },
  { id: "bilder", label: "Fotos & Grafiken", icon: Images },
  { id: "regeln", label: "Dos & Don'ts", icon: ListChecks },
] as const;

/** Variante aus dem Dateinamen erraten (Mehrfach-Upload) */
function guessVariant(name: string, hasMain: boolean) {
  const n = name.toLowerCase();
  if (/negativ|wei(ss|ß)|white|hell/.test(n)) return "Negativ (hell auf dunkel)";
  if (/schrift|wort|text|type/.test(n)) return "Wortmarke";
  if (/icon|signet|bildmarke|symbol|favicon/.test(n)) return "Icon / Bildmarke";
  return hasMain ? "Sonstige" : "Hauptlogo";
}

/** Google-Schrift für die Vorschau laden (wenn es sie dort gibt) */
function useFontPreview(family: string) {
  useEffect(() => {
    const name = family.trim().replace(/\s+(Bold|Regular|Light|Medium|Black|Italic)$/i, "");
    if (!name || document.querySelector(`link[data-font="${CSS.escape(name)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.dataset.font = name;
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }, [family]);
}

function Section({ id, title, hint, action, children }: { id: string; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-snow/[0.08] bg-panel p-5">
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-[12.5px] text-snow/55">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function BrandEditor({ workspaceId, initial }: { workspaceId: string; initial: BrandResponse }) {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const [brand, setBrand] = useState<Brand>(initial.brand);
  const [brief, setBrief] = useState(initial.brief);
  const [saving, setSaving] = useState(0);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busy, setBusy] = useState<"suggest" | "canva" | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  /** Speichert nur die übergebenen Felder (Autosave) */
  async function save(patch: Partial<Brand>) {
    setSaving((n) => n + 1);
    try {
      const result = await api<BrandResponse>(brandUrl(workspaceId), { method: "PATCH", body: JSON.stringify(patch) });
      setBrief(result.brief);
      mutate<BrandResponse>(brandUrl(workspaceId), () => result);
      if (patch.colors || patch.logos) revalidate(URL_WORKSPACES);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setSaving((n) => n - 1);
  }

  const set = <K extends keyof Brand>(key: K, value: Brand[K]) => setBrand((b) => ({ ...b, [key]: value }));
  const change = <K extends keyof Brand>(key: K, value: Brand[K]) => {
    set(key, value);
    void save({ [key]: value } as Partial<Brand>);
  };

  /** Neu laden (nach Uploads oder Canva-Import) */
  async function reload() {
    const fresh = await api<BrandResponse>(brandUrl(workspaceId));
    setBrand(fresh.brand);
    setBrief(fresh.brief);
    mutate<BrandResponse>(brandUrl(workspaceId), () => fresh);
    revalidate(URL_WORKSPACES);
  }

  async function suggest() {
    setBusy("suggest");
    try {
      setSuggestion(await api<Suggestion>(`${brandUrl(workspaceId)}/suggest`, { method: "POST" }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vorschlag fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function fromCanva() {
    setBusy("canva");
    try {
      const result = await api<{ design: string; updated: string[] }>(`${URL_WORKSPACES}/${workspaceId}/canva-ci`, { method: "POST" });
      await reload();
      toast(`Aus „${result.design}“ übernommen: ${result.updated.join(", ") || "nichts Neues"}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Canva nicht erreichbar", "error");
    }
    setBusy(null);
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

  const main = brand.logos.find((l) => l.variant === "Hauptlogo");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Kopf wie im Brand Kit: Marke, Farben auf einen Blick, Aktionen */}
      <div className="border-b border-snow/[0.08] px-4 py-5 md:px-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-snow/[0.08] bg-white p-2">
            {main?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Logo aus dem Storage
              <img src={main.url} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[18px] font-semibold text-black/60">{workspace?.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium tracking-wide text-snow/50 uppercase">Markenkit</p>
            <h2 className="truncate text-[22px] font-semibold tracking-tight">{workspace?.name}</h2>
            <div className="mt-1.5 flex items-center gap-1">
              {brand.colors.slice(0, 10).map((c, i) => (
                <span key={i} title={`${c.name || c.role} ${c.hex}`} className="h-4 w-4 rounded-full ring-1 ring-snow/15" style={{ background: c.hex }} />
              ))}
              {brand.fonts[0] && <span className="ml-2 text-[12.5px] text-snow/55">{brand.fonts.map((f) => f.family).join(" · ")}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-9" icon={<Download className="h-4 w-4" />} loading={busy === "canva"} loadingText="Holt aus Canva …" disabled={busy !== null} onClick={fromCanva} title={`Aus dem Canva-Design „CI – ${workspace?.name}“`}>
              Aus Canva
            </Button>
            <Button size="sm" className="h-9" icon={<Sparkles className="h-4 w-4" />} loading={busy === "suggest"} loadingText="Claude liest …" disabled={busy !== null} onClick={suggest}>
              Mit Claude vorschlagen
            </Button>
            <Button size="sm" variant={showBrief ? "secondary" : "ghost"} className="h-9" icon={<Bot className="h-4 w-4" />} aria-pressed={showBrief} onClick={() => setShowBrief((v) => !v)}>
              Agent-Vorgabe
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 pt-6 pb-16 md:px-7 lg:grid-cols-[200px_minmax(0,1fr)]">
        {/* Inhaltsverzeichnis wie in der Brand-Kit-Seitenleiste */}
        <nav aria-label="Markenkit" className="hidden lg:block">
          <ul className="sticky top-4 grid gap-0.5">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <li key={id}>
                <a href={`#${id}`} className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-snow/65 hover:bg-snow/[0.06] hover:text-snow">
                  <Icon className="h-4 w-4" strokeWidth={1.8} /> {label}
                </a>
              </li>
            ))}
            <li className="mt-3 px-2.5 text-[11.5px] text-snow/45" aria-live="polite">
              {saving > 0 ? "Wird gespeichert …" : "Alles gespeichert"}
            </li>
          </ul>
        </nav>

        <div className="grid min-w-0 gap-5">
          {showBrief && <AgentBrief brief={brief} />}
          <LogoKit workspaceId={workspaceId} logos={brand.logos} onChange={(logos) => change("logos", logos)} onUploaded={reload} />
          <ColorKit colors={brand.colors} onChange={(colors) => change("colors", colors)} />
          <FontKit fonts={brand.fonts} onChange={(fonts) => change("fonts", fonts)} />

          <Section id="stimme" title="Markenstimme" hint="So klingt die Marke: gilt für alle Texte, Captions und Voiceovers des Agenten.">
            <div className="grid gap-4">
              <Field label="Website">
                {(id) => <Input id={id} value={brand.website ?? ""} onChange={(e) => set("website", e.target.value)} onBlur={() => save({ website: brand.website })} placeholder="https://" />}
              </Field>
              <TextBlock label="Tonalität und Ansprache" value={brand.tone} onChange={(v) => set("tone", v)} onSave={(tone) => save({ tone })} placeholder="z. B. herzlich, nahbar, mit Augenzwinkern; wir duzen die Community" />
              <TextBlock label="Zielgruppe" value={brand.audience} onChange={(v) => set("audience", v)} onSave={(audience) => save({ audience })} />
              <VoicePicker value={brand.voice_id ?? ""} onSave={(voice_id) => change("voice_id", voice_id)} />
            </div>
          </Section>

          <AssetKit workspaceId={workspaceId} brand={brand} onImagery={(v) => set("imagery", v)} onSaveImagery={(imagery) => save({ imagery })} onChange={(assets) => change("assets", assets)} onUploaded={reload} />

          <Section id="regeln" title="Dos & Don'ts" hint="Klare Regeln für Team und Agent. Enter fügt hinzu.">
            <div className="grid gap-5 md:grid-cols-2">
              <Chips label="Dos" tone="#30a46c" items={brand.dos} onChange={(dos) => change("dos", dos)} placeholder="z. B. Handwerk zeigen" />
              <Chips label="Don'ts" tone="#e5484d" items={brand.donts} onChange={(donts) => change("donts", donts)} placeholder="z. B. keine Stockfotos" />
            </div>
            <div className="mt-5 grid gap-5">
              <Chips label="Hashtags" items={brand.hashtags} onChange={(hashtags) => change("hashtags", hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, "")))} placeholder="#hashtag" inline />
              <TextBlock label="Weitere Hinweise" value={brand.notes} onChange={(v) => set("notes", v)} onSave={(notes) => save({ notes })} placeholder="Freigaben, Postingplan, Formate, Ansprechpartner für Content …" />
            </div>
          </Section>
        </div>
      </div>
      {suggestion && <SuggestionDialog suggestion={suggestion} onClose={() => setSuggestion(null)} onAccept={accept} />}
    </div>
  );
}

// ---------- Logos ----------

/** Karo-Muster für transparente Logos */
const CHECKER = "bg-[length:14px_14px] bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)]";

function LogoKit({ workspaceId, logos, onChange, onUploaded }: { workspaceId: string; logos: Brand["logos"]; onChange: (logos: Brand["logos"]) => void; onUploaded: () => Promise<void> }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [dark, setDark] = useState<Set<string>>(new Set());

  async function upload(files: File[]) {
    setBusy(true);
    let hasMain = logos.some((l) => l.variant === "Hauptlogo");
    for (const file of files) {
      try {
        const form = new FormData();
        const variant = guessVariant(file.name, hasMain);
        hasMain ||= variant === "Hauptlogo";
        form.append("file", file);
        form.append("variant", variant);
        await api(`${URL_WORKSPACES}/${workspaceId}/logo`, { method: "POST", body: form });
      } catch (error) {
        toast(`${file.name}: ${error instanceof Error ? error.message : "Hochladen fehlgeschlagen"}`, "error");
      }
    }
    await onUploaded().catch(() => undefined);
    setBusy(false);
  }

  /** Variante ändern; „Hauptlogo“ gibt es nur einmal und färbt die Akte */
  async function setVariant(path: string, variant: string) {
    const next = logos.map((l) => (l.path === path ? { ...l, variant } : variant === "Hauptlogo" && l.variant === "Hauptlogo" ? { ...l, variant: "Sonstige" } : l));
    onChange(next);
    if (variant === "Hauptlogo") await api(`${URL_WORKSPACES}/${workspaceId}`, { method: "PATCH", body: JSON.stringify({ logo_path: path }) }).catch(() => undefined);
    revalidate(URL_WORKSPACES);
  }

  async function remove(path: string) {
    const removed = logos.find((l) => l.path === path);
    const next = logos.filter((l) => l.path !== path);
    onChange(next);
    if (removed?.variant === "Hauptlogo") {
      await api(`${URL_WORKSPACES}/${workspaceId}`, { method: "PATCH", body: JSON.stringify({ logo_path: null }) }).catch(() => undefined);
      revalidate(URL_WORKSPACES);
    }
  }

  const tileBase = "group relative flex aspect-[4/3] flex-col overflow-hidden rounded-xl border";

  return (
    <Section
      id="logos"
      title="Logos"
      hint="Das Hauptlogo erscheint in der Übersicht, in der Akte und auf den Post-Grafiken. PNG mit transparentem Hintergrund ist ideal."
      action={
        <Button size="sm" icon={<Upload className="h-4 w-4" />} loading={busy} loadingText="Lädt hoch …" onClick={() => input.current?.click()}>
          Hochladen
        </Button>
      }
    >
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void upload(files);
          e.target.value = "";
        }}
      />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {logos.map((logo) => {
          const isDark = dark.has(logo.path) || logo.variant.startsWith("Negativ");
          return (
            <li key={logo.path}>
              <div className={clsx(tileBase, "border-snow/[0.08]", isDark ? "bg-[#141414]" : `bg-white ${CHECKER}`)}>
                <div className="grid min-h-0 flex-1 place-items-center p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Logo aus dem Storage */}
                  <img src={logo.url} alt={logo.variant} className="max-h-full max-w-full object-contain" />
                </div>
                {logo.variant === "Hauptlogo" && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10.5px] font-medium text-white">
                    <Star className="h-3 w-3 fill-current" /> Hauptlogo
                  </span>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    title="Hintergrund hell/dunkel"
                    aria-label="Hintergrund hell oder dunkel"
                    onClick={() => setDark((s) => (s.has(logo.path) ? new Set([...s].filter((p) => p !== logo.path)) : new Set(s).add(logo.path)))}
                    className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Contrast className="h-3.5 w-3.5" />
                  </button>
                  <a href={logo.url} download className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80" title="Herunterladen" aria-label="Herunterladen">
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button type="button" onClick={() => remove(logo.path)} className="grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-[#e5484d]" title="Entfernen" aria-label="Logo entfernen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <Select value={LOGO_VARIANTS.includes(logo.variant) ? logo.variant : "Sonstige"} onChange={(e) => setVariant(logo.path, e.target.value)} aria-label="Variante" className="mt-1.5 h-8 w-full text-[12.5px]">
                {LOGO_VARIANTS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const files = [...e.dataTransfer.files].filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
              if (files.length) void upload(files);
            }}
            className={clsx(tileBase, "w-full place-items-center justify-center gap-1.5 border-dashed text-snow/55 hover:border-snow/40 hover:text-snow", over ? "border-snow bg-snow/[0.06]" : "border-snow/20")}
          >
            {busy ? <Spinner /> : <Plus className="mx-auto h-6 w-6" />}
            <span className="text-[13px] font-medium">Logos hierher ziehen</span>
            <span className="text-[11.5px] text-snow/45">oder klicken · mehrere möglich</span>
          </button>
        </li>
      </ul>
    </Section>
  );
}

// ---------- Farben ----------

function ColorKit({ colors, onChange }: { colors: BrandColor[]; onChange: (c: BrandColor[]) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<BrandColor | null>(null);

  const open = (index: number) => {
    setEditing(index);
    setDraft({ ...colors[index] });
  };
  const add = () => {
    const color: BrandColor = { name: "", hex: "#c49444", role: colors.some((c) => c.role === "Primär") ? (colors.some((c) => c.role === "Sekundär") ? "Akzent" : "Sekundär") : "Primär" };
    setEditing(colors.length);
    setDraft(color);
  };
  const commit = () => {
    if (!draft || editing === null || !/^#[0-9a-f]{6}$/i.test(draft.hex)) return toast("Hex-Wert wie #c49444", "error");
    // Primär und Sekundär gibt es nur einmal
    const others = colors.map((c, i) => (i !== editing && (draft.role === "Primär" || draft.role === "Sekundär") && c.role === draft.role ? { ...c, role: "Akzent" as const } : c));
    const next = editing < colors.length ? others.map((c, i) => (i === editing ? draft : c)) : [...others, draft];
    onChange(next);
    setEditing(null);
  };
  const remove = () => {
    if (editing === null) return;
    onChange(colors.filter((_, i) => i !== editing));
    setEditing(null);
  };
  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      toast(`${hex} kopiert`);
    } catch {
      toast("Kopieren nicht möglich", "error");
    }
  };
  const order = (c: BrandColor) => COLOR_ROLES.indexOf(c.role);
  const sorted = colors.map((c, i) => ({ c, i })).sort((a, b) => order(a.c) - order(b.c));

  return (
    <Section id="farben" title="Farben" hint="Primär- und Sekundärfarbe färben die Akte und die Post-Grafiken. Klick auf eine Farbe zum Bearbeiten.">
      <div className="flex flex-wrap gap-x-5 gap-y-4">
        {sorted.map(({ c, i }) => (
          <div key={i} className="group w-20 text-center">
            <button type="button" onClick={() => open(i)} className="mx-auto block h-20 w-20 rounded-full shadow-sm ring-1 ring-snow/15 transition-transform hover:scale-105" style={{ background: c.hex }} aria-label={`${c.name || c.role} bearbeiten`} />
            <button type="button" onClick={() => copy(c.hex)} className="mt-2 font-mono text-[12px] text-snow/80 hover:text-snow" title="Hex kopieren">
              {c.hex.toUpperCase()}
            </button>
            <p className="truncate text-[11.5px] text-snow/50">{c.name || c.role}</p>
            {c.name && <p className="truncate text-[10.5px] text-snow/40">{c.role}</p>}
          </div>
        ))}
        <div className="w-20 text-center">
          <button type="button" onClick={add} className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-snow/20 text-snow/50 hover:border-snow/40 hover:text-snow" aria-label="Farbe hinzufügen">
            <Plus className="h-6 w-6" />
          </button>
          <p className="mt-2 text-[12px] text-snow/50">Farbe</p>
        </div>
      </div>
      {draft && editing !== null && (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={editing < colors.length ? "Farbe bearbeiten" : "Neue Farbe"}
          footer={
            <>
              {editing < colors.length && (
                <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={remove} className="mr-auto text-error">
                  Entfernen
                </Button>
              )}
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Abbrechen
              </Button>
              <Button variant="primary" onClick={commit}>
                Übernehmen
              </Button>
            </>
          }
        >
          <div className="grid gap-4">
            <div className="flex items-center gap-4">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(draft.hex) ? draft.hex : "#000000"} onChange={(e) => setDraft({ ...draft, hex: e.target.value })} aria-label="Farbe wählen" className="h-20 w-20 cursor-pointer rounded-full border-0 bg-transparent" />
              <div className="grid flex-1 gap-2">
                <Input value={draft.hex} onChange={(e) => setDraft({ ...draft, hex: e.target.value.trim() })} aria-label="Hex" className="font-mono" placeholder="#c49444" />
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Name" placeholder="Name, z. B. Ofengold" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rolle">
              {COLOR_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={draft.role === role}
                  onClick={() => setDraft({ ...draft, role })}
                  className={clsx("h-8 rounded-full border px-3 text-[12.5px]", draft.role === role ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/65 hover:text-snow")}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </Dialog>
      )}
    </Section>
  );
}

// ---------- Schriften ----------

const FONT_ROLES = ["Überschrift", "Unterüberschrift", "Text", "Akzent"];
const SAMPLE: Record<string, { text: string; size: string; weight: number }> = {
  Überschrift: { text: "Überschrift in der Hausschrift", size: "text-[30px]", weight: 700 },
  Unterüberschrift: { text: "Eine Unterüberschrift", size: "text-[21px]", weight: 600 },
  Text: { text: "Fließtext für Captions, Folien und Grafiken – gut lesbar.", size: "text-[15px]", weight: 400 },
};

function FontRow({ font, onChange, onRemove }: { font: BrandFont; onChange: (f: BrandFont) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState(font);
  useFontPreview(font.family);
  const sample = SAMPLE[font.role] ?? { text: "Aa Bb Cc 0123 – Akzentschrift", size: "text-[19px]", weight: 400 };
  const commit = () => JSON.stringify(draft) !== JSON.stringify(font) && onChange(draft);
  return (
    <li className="group grid gap-3 border-b border-snow/[0.06] py-4 last:border-0 md:grid-cols-[160px_minmax(0,1fr)_auto] md:items-center">
      <div className="grid gap-1.5">
        <Select value={FONT_ROLES.includes(draft.role) ? draft.role : "Akzent"} onChange={(e) => onChange({ ...draft, role: e.target.value })} aria-label="Einsatz" className="h-8 text-[12.5px]">
          {FONT_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        <Input value={draft.family} onChange={(e) => setDraft({ ...draft, family: e.target.value })} onBlur={commit} aria-label="Schriftname" placeholder="z. B. Montserrat" className="h-8 text-[12.5px]" />
      </div>
      <div className="min-w-0">
        <p className={clsx("truncate leading-tight", sample.size)} style={{ fontFamily: `"${font.family}", var(--font-sans, sans-serif)`, fontWeight: sample.weight }}>
          {sample.text}
        </p>
        <input value={draft.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onBlur={commit} aria-label="Hinweis" placeholder="Hinweis, z. B. nur Versalien, Laufweite +50" className="mt-1 w-full bg-transparent text-[12px] text-snow/55 outline-none placeholder:text-snow/35" />
      </div>
      <IconButton label="Schrift entfernen" className="h-8 w-8 text-snow/45 hover:text-error md:opacity-0 md:group-hover:opacity-100" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </li>
  );
}

function FontKit({ fonts, onChange }: { fonts: BrandFont[]; onChange: (f: BrandFont[]) => void }) {
  const next = FONT_ROLES.find((r) => !fonts.some((f) => f.role === r)) ?? "Akzent";
  return (
    <Section
      id="schriften"
      title="Schriften"
      hint="Die Überschrift-Schrift nutzt der Agent für Post-Grafiken (Google Fonts werden automatisch geladen)."
      action={
        <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...fonts, { role: next, family: "" }])}>
          Schrift
        </Button>
      }
    >
      {fonts.length === 0 ? (
        <p className="text-[13px] text-snow/55">Noch keine Schriften. Füge Überschrift, Unterüberschrift und Text hinzu.</p>
      ) : (
        <ul>
          {fonts.map((font, i) => (
            <FontRow key={`${i}-${font.role}-${font.family}`} font={font} onChange={(f) => onChange(fonts.map((x, j) => (j === i ? f : x)))} onRemove={() => onChange(fonts.filter((_, j) => j !== i))} />
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------- Fotos & Grafiken ----------

function AssetKit({
  workspaceId,
  brand,
  onImagery,
  onSaveImagery,
  onChange,
  onUploaded,
}: {
  workspaceId: string;
  brand: Brand;
  onImagery: (v: string) => void;
  onSaveImagery: (v: string) => void;
  onChange: (assets: Brand["assets"]) => void;
  onUploaded: () => Promise<void>;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<BrandAsset["kind"]>("Foto");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function upload(files: File[]) {
    setBusy(true);
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", kind);
        await api(`${URL_WORKSPACES}/${workspaceId}/assets`, { method: "POST", body: form });
      } catch (error) {
        toast(`${file.name}: ${error instanceof Error ? error.message : "Hochladen fehlgeschlagen"}`, "error");
      }
    }
    await onUploaded().catch(() => undefined);
    setBusy(false);
  }

  return (
    <Section
      id="bilder"
      title="Fotos & Grafiken"
      hint="Bildmaterial der Marke: Der Agent kann es für Posts verwenden. Dazu die Bildsprache als Vorgabe."
      action={
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-snow/12 p-0.5" role="radiogroup" aria-label="Art">
            {ASSET_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={clsx("h-7 rounded-full px-2.5 text-[12px]", kind === k ? "bg-snow text-sky" : "text-snow/60 hover:text-snow")}>
                {k}
              </button>
            ))}
          </div>
          <Button size="sm" icon={<Upload className="h-4 w-4" />} loading={busy} loadingText="Lädt hoch …" onClick={() => input.current?.click()}>
            Hochladen
          </Button>
        </div>
      }
    >
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void upload(files);
          e.target.value = "";
        }}
      />
      <TextBlock label="Bildsprache und Gestaltung" value={brand.imagery} onChange={onImagery} onSave={onSaveImagery} placeholder="z. B. warmes Tageslicht, echte Menschen, viel Weißraum, Logo unten rechts" />
      <ul
        className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6"
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const files = [...e.dataTransfer.files].filter((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type));
          if (files.length) void upload(files);
        }}
      >
        {brand.assets.map((asset) => (
          <li key={asset.path} className="group relative aspect-square overflow-hidden rounded-xl border border-snow/[0.08] bg-snow/[0.04]">
            {/* eslint-disable-next-line @next/next/no-img-element -- Bild aus dem Storage */}
            <img src={asset.url} alt={asset.notes ?? asset.kind} className={clsx("h-full w-full", asset.kind === "Foto" ? "object-cover" : "object-contain p-3")} />
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] text-white">{asset.kind}</span>
            <button
              type="button"
              onClick={() => onChange(brand.assets.filter((a) => a.path !== asset.path))}
              className="absolute top-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-100 hover:bg-[#e5484d] md:opacity-0 md:group-hover:opacity-100"
              aria-label="Bild entfernen"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={clsx("grid aspect-square w-full place-items-center rounded-xl border border-dashed text-center text-snow/50 hover:border-snow/40 hover:text-snow", over ? "border-snow bg-snow/[0.06]" : "border-snow/20")}
          >
            <span>
              {busy ? <Spinner /> : <ImagePlus className="mx-auto h-5 w-5" />}
              <span className="mt-1 block text-[11.5px]">{kind} hinzufügen</span>
            </span>
          </button>
        </li>
      </ul>
    </Section>
  );
}

// ---------- Texte und Listen ----------

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

/** Liste als Chips: Enter fügt hinzu, × entfernt */
function Chips({ label, items, onChange, placeholder, tone, inline = false }: { label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string; tone?: string; inline?: boolean }) {
  const [text, setText] = useState("");
  const add = () => {
    const values = text
      .split(inline ? /[\s,]+/ : /\n/)
      .map((v) => v.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    if (values.length) onChange([...new Set([...items, ...values])]);
    setText("");
  };
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[13px] font-medium">
        {tone && <span className="h-2 w-2 rounded-full" style={{ background: tone }} />}
        {label} <span className="text-snow/40">{items.length}</span>
      </p>
      <ul className={clsx("mb-2 gap-1.5", inline ? "flex flex-wrap" : "grid")}>
        {items.map((item) => (
          <li
            key={item}
            className={clsx("group flex items-start gap-2 rounded-xl border border-snow/[0.08] bg-snow/[0.03] text-[13px]", inline ? "rounded-full py-1 pr-1.5 pl-3" : "px-3 py-2")}
            style={tone ? { borderLeft: `3px solid ${tone}` } : undefined}
          >
            <span className="min-w-0 flex-1">{item}</span>
            <button type="button" onClick={() => onChange(items.filter((x) => x !== item))} className="shrink-0 text-snow/35 hover:text-error" aria-label={`${item} entfernen`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={() => text.trim() && add()}
        placeholder={placeholder}
        aria-label={`${label} hinzufügen`}
        className="h-9 text-[13px]"
      />
    </div>
  );
}

type Voice = { voice_id: string; name: string; labels: Record<string, string> };

/** Stimme für Voiceovers (ElevenLabs); ohne Schlüssel als freies Feld */
function VoicePicker({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const status = useMarketingStatus();
  const ready = !!status.data?.tools.elevenlabs;
  const voices = useResource<Voice[]>(ready ? "/api/marketing/video/voices" : null);
  const [text, setText] = useState(value);
  return (
    <Field label="Stimme für Voiceover (ElevenLabs)">
      {(id) =>
        ready && voices.data ? (
          <Select id={id} value={value} onChange={(e) => onSave(e.target.value)}>
            <option value="">Keine feste Stimme</option>
            {voices.data.map((v) => (
              <option key={v.voice_id} value={v.voice_id}>
                {v.name}
                {Object.values(v.labels).length ? ` · ${Object.values(v.labels).join(", ")}` : ""}
              </option>
            ))}
          </Select>
        ) : (
          <Input id={id} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onSave(text.trim())} placeholder={ready ? "Stimmen werden geladen …" : "Voice-ID (ElevenLabs noch nicht verbunden)"} />
        )
      }
    </Field>
  );
}

function AgentBrief({ brief }: { brief: string }) {
  const toast = useToast();
  return (
    <aside>
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
