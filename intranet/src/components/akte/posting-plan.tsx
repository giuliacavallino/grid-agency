"use client";

import { useRef, useState } from "react";
import { CalendarRange, FileText, Plus, Save, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { PROVIDERS, type PostProvider } from "@/lib/marketing";
import { cleanPlan, EMPTY_PLAN, PERIOD_LABELS, QUOTA_KIND_LIST, QUOTA_KINDS, ruleText, type PlanRule, type PostingPlan, type QuotaPeriod } from "@/lib/posting-plan";
import { useTeam } from "@/components/access";
import { Button, Field, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { ProviderMark } from "@/components/marketing/common";
import { URL_WORKSPACES, useCurrentWorkspace, type WorkspaceSummary } from "@/components/marketing/workspace";
import { AkteHeader } from "./header";

// Postingplan der Akte: Mengen aus dem Agenturvertrag (Claude liest das PDF,
// das Team bestätigt), zuständige Person für die Erinnerungen in der Glocke
// und ob die Akte überhaupt eine Social-Media-Planung hat.

const planUrl = (id: string) => `/api/marketing/workspaces/${id}/posting-plan`;

export function PostingPlanSettings() {
  const { workspace } = useCurrentWorkspace();
  const saved = useResource<PostingPlan>(workspace ? planUrl(workspace.id) : null);
  if (!workspace || !saved.data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  return <PlanForm key={JSON.stringify(saved.data) + workspace.planning} workspace={workspace} initial={saved.data} />;
}

function PlanForm({ workspace, initial }: { workspace: WorkspaceSummary; initial: PostingPlan }) {
  const toast = useToast();
  const team = useTeam();
  const url = planUrl(workspace.id);
  const file = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<PostingPlan>({ ...EMPTY_PLAN, ...initial });
  const [planning, setPlanning] = useState(workspace.planning !== false);
  const [proposal, setProposal] = useState(false);
  const [busy, setBusy] = useState<"save" | "read" | null>(null);
  const dirty = proposal || planning !== (workspace.planning !== false) || JSON.stringify(cleanPlan(plan)) !== JSON.stringify(cleanPlan(initial));
  const set = <K extends keyof PostingPlan>(key: K, value: PostingPlan[K]) => setPlan((p) => ({ ...p, [key]: value }));
  const setRule = (index: number, patch: Partial<PlanRule>) => set("rules", plan.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  async function read(pdf: File) {
    setBusy("read");
    try {
      const form = new FormData();
      form.append("file", pdf);
      const next = await api<PostingPlan>(`${url}/contract`, { method: "POST", body: form });
      setPlan({ ...next, owner: plan.owner });
      setProposal(true);
      toast(`${next.rules.length} Regeln aus „${pdf.name}“ gelesen, bitte prüfen und speichern`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vertrag konnte nicht gelesen werden", "error");
    }
    setBusy(null);
  }

  async function save() {
    setBusy("save");
    try {
      const next = await api<PostingPlan>(url, { method: "PUT", body: JSON.stringify({ ...plan, planning }) });
      mutate<PostingPlan>(url, () => next);
      revalidate(URL_WORKSPACES);
      setProposal(false);
      toast("Postingplan gespeichert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Postingplan" meta="Was laut Vertrag gepostet wird; die zuständige Person wird in der Glocke erinnert">
        <input
          ref={file}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const pdf = e.target.files?.[0];
            e.target.value = "";
            if (pdf) read(pdf);
          }}
        />
        <Button size="sm" className="h-9" icon={<Upload className="h-4 w-4" />} loading={busy === "read"} loadingText="Claude liest den Vertrag …" disabled={busy !== null} onClick={() => file.current?.click()}>
          Vertrag hochladen
        </Button>
        <Button variant="primary" size="sm" className="h-9" icon={<Save className="h-4 w-4" />} loading={busy === "save"} loadingText="Wird gespeichert …" disabled={busy !== null || !dirty} onClick={save}>
          Speichern
        </Button>
      </AkteHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid max-w-3xl gap-5 p-4 pb-12 md:p-7">
          {proposal && (
            <p className="flex items-center gap-2 rounded-2xl border border-snow/15 bg-snow/[0.05] px-4 py-3 text-[13px]">
              <FileText className="h-4 w-4 shrink-0" />
              Vorschlag aus „{plan.source?.name}“: bitte prüfen, bei Bedarf anpassen und speichern.
            </p>
          )}

          <section className="flex items-start gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-4">
            <CalendarRange className="mt-0.5 h-5 w-5 text-snow/60" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Social-Media-Planung {planning ? "an" : "aus"}</p>
              <p className="text-[12.5px] text-snow/55">Aus bei Kunden ohne Social Media (z. B. reine Google-Betreuung): Die Planung verschwindet aus der Akte, der Tage-Autopilot legt nichts an.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={planning}
              aria-label="Social-Media-Planung an oder aus"
              onClick={() => setPlanning((v) => !v)}
              className={clsx("relative h-6 w-11 shrink-0 rounded-full transition-colors", planning ? "" : "bg-snow/20")}
              style={planning ? { background: "var(--akte)" } : undefined}
            >
              <span className={clsx("absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform", planning ? "translate-x-[22px]" : "translate-x-0.5")} />
            </button>
          </section>

          {planning && (
            <>
              <section className="grid gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-5 sm:grid-cols-2">
                <Field label="Zuständig (bekommt die Erinnerungen)">
                  {(id) => (
                    <Select id={id} value={plan.owner ?? ""} onChange={(e) => set("owner", e.target.value || null)} className="h-10">
                      <option value="">Niemand (Admins werden erinnert)</option>
                      {team.map((m) => (
                        <option key={m.email} value={m.email.toLowerCase()}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Voller Umfang ab">
                  {(id) => <Input id={id} type="date" value={plan.start ?? ""} onChange={(e) => set("start", e.target.value || null)} className="h-10" />}
                </Field>
              </section>

              <section className="grid gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-semibold">Regeln</p>
                  <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => set("rules", [...plan.rules, { kind: "beitrag", count: 3, period: "week" }])}>
                    Regel
                  </Button>
                </div>
                {!plan.rules.length && <p className="text-[13px] text-snow/55">Noch keine Regeln. Vertrag hochladen oder Regel hinzufügen.</p>}
                {plan.rules.map((rule, index) => (
                  <div key={index} className="grid items-end gap-2 rounded-xl bg-snow/[0.03] p-3 sm:grid-cols-[140px_1fr_auto_auto_auto]">
                    <Field label="Zeitraum">
                      {(id) => (
                        <Select id={id} value={rule.period} onChange={(e) => setRule(index, { period: e.target.value as QuotaPeriod, every: e.target.value === "days" ? rule.every ?? 2 : null })} className="h-10">
                          {(Object.keys(PERIOD_LABELS) as QuotaPeriod[]).map((p) => (
                            <option key={p} value={p}>
                              {PERIOD_LABELS[p]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label="Was">
                      {(id) => (
                        <Select id={id} value={rule.kind} onChange={(e) => setRule(index, { kind: e.target.value as PlanRule["kind"] })} className="h-10">
                          {QUOTA_KIND_LIST.map((k) => (
                            <option key={k} value={k}>
                              {QUOTA_KINDS[k].label}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    {rule.period === "days" ? (
                      <Field label="Alle … Tage">
                        {(id) => <Input id={id} type="number" min={1} max={31} value={rule.every ?? 2} onChange={(e) => setRule(index, { every: Number(e.target.value) })} className="h-10 w-24" />}
                      </Field>
                    ) : (
                      <>
                        <Field label="Mindestens">
                          {(id) => <Input id={id} type="number" min={1} value={rule.count} onChange={(e) => setRule(index, { count: Number(e.target.value) })} className="h-10 w-24" />}
                        </Field>
                        <Field label="Höchstens">
                          {(id) => <Input id={id} type="number" min={0} value={rule.max ?? ""} placeholder="–" onChange={(e) => setRule(index, { max: e.target.value ? Number(e.target.value) : null })} className="h-10 w-24" />}
                        </Field>
                      </>
                    )}
                    <Button variant="ghost" className="h-10 text-error" icon={<Trash2 className="h-4 w-4" />} aria-label={`Regel „${ruleText(rule)}“ entfernen`} onClick={() => set("rules", plan.rules.filter((_, i) => i !== index))} />
                  </div>
                ))}
              </section>

              <section className="grid gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-5">
                <div>
                  <p className="mb-2 text-[13px] font-medium">Plattformen laut Vertrag</p>
                  <div className="flex flex-wrap gap-2">
                    {(["instagram", "facebook", "tiktok", "linkedin"] as PostProvider[]).map((p) => {
                      const on = plan.platforms.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={on}
                          onClick={() => set("platforms", on ? plan.platforms.filter((x) => x !== p) : [...plan.platforms, p])}
                          className={clsx("flex h-9 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-[13px]", on ? "border-snow/40 bg-snow/[0.08]" : "border-snow/12 text-snow/55")}
                        >
                          <ProviderMark provider={p} /> {PROVIDERS[p].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field label="Weitere Regeln">
                  {(id) => <Textarea id={id} rows={4} value={plan.notes} onChange={(e) => set("notes", e.target.value)} placeholder="z. B. Neue Beiträge per Story bewerben, 1 Feedbackschleife je Beitrag" />}
                </Field>
                {plan.source && <p className="text-[12px] text-snow/45">Quelle: {plan.source.name}</p>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
