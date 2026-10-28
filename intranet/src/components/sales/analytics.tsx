"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRows } from "@/lib/data";
import { euro, num, percent } from "@/lib/format";
import { SOURCES, STAGES, type Lead, type Retainer, type Source } from "@/lib/sales/types";
import { Empty, Select, Spinner } from "@/components/ui";
import { PageBar } from "./shell";
import { ChartCard } from "./charts/chart-card";
import { BarList, ColumnChart, LineChart } from "./charts/charts";
import { SERIES_1, SOURCE_CHART_COLOR } from "./charts/theme";
import { monthRange, monthTotals } from "./orderbook";

const DAY = 86_400_000;

const PERIODS = [
  { days: 30, label: "Letzte 30 Tage" },
  { days: 90, label: "Letzte 90 Tage" },
  { days: 365, label: "Letzte 12 Monate" },
] as const;

const stageIndex = (stage: Lead["stage"]) => STAGES.findIndex((s) => s.id === stage);

type Bucket = { start: number; end: number; short: string; long: string };

/** Wochen (bis 90 Tage) oder Monate (12 Monate) über den Zeitraum. */
function buckets(days: number, now: Date): Bucket[] {
  if (days > 90) {
    return Array.from({ length: 12 }, (_, i) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
      return {
        start: start.getTime(),
        end: end.getTime(),
        short: start.toLocaleDateString("de-DE", { month: "short" }),
        long: start.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
      };
    });
  }
  // Wochen ab Montag
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const weeks = Math.ceil(days / 7);
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - i));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
    return {
      start: start.getTime(),
      end: end.getTime(),
      short: fmt(start),
      long: `Woche ab ${start.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}`,
    };
  });
}

function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
  if (previous === 0 && current === 0) return <p className="mt-0.5 text-[12px] text-snow/45">{label}: keine</p>;
  const change = previous === 0 ? 1 : (current - previous) / previous;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <p className={cn("mt-0.5 flex items-center gap-1 text-[12px]", change > 0 ? "text-success" : change < 0 ? "text-error" : "text-snow/50")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {change > 0 ? "+" : ""}
      {previous === 0 ? "neu" : percent(change)} <span className="text-snow/45">{label}</span>
    </p>
  );
}

function Tile({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-snow/[0.06] bg-surface px-4 py-3">
      <p className="text-[12px] text-snow/55">{label}</p>
      <p className="mt-1 truncate text-[24px] font-semibold tracking-tight">{value}</p>
      {children}
    </div>
  );
}

export function Analytics() {
  // Ohne Statusfilter, damit verlorene Leads mitzählen
  const { data: leads, loading, error } = useRows<Lead>("leads");
  const { data: retainers } = useRows<Retainer>("retainers");
  const [days, setDays] = useState<number>(90);

  const stats = useMemo(() => {
    const all = leads ?? [];
    const now = new Date();
    const since = now.getTime() - days * DAY;
    const before = since - days * DAY;
    const created = (l: Lead) => new Date(l.created_at).getTime();
    const cohort = all.filter((l) => created(l) >= since);
    const previous = all.filter((l) => created(l) >= before && created(l) < since);

    const won = cohort.filter((l) => l.stage === "gewonnen" && l.status !== "verloren");
    const lost = cohort.filter((l) => l.status === "verloren");
    const closeRate = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : null;

    const wonInPeriod = all.filter((l) => l.won_at && new Date(l.won_at).getTime() >= since);
    const cycle = wonInPeriod.length
      ? wonInPeriod.reduce((sum, l) => sum + (new Date(l.won_at!).getTime() - created(l)) / DAY, 0) / wonInPeriod.length
      : null;

    const open = all.filter((l) => l.status === "offen" && l.stage !== "gewonnen");
    const pipelineValue = open.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

    // Leads je Zeitabschnitt und Quelle
    const periods = buckets(days, now);
    const perBucket = periods.map((b) => {
      const row: Record<string, number> = {};
      for (const l of all) {
        const t = created(l);
        if (t >= b.start && t < b.end) row[l.source] = (row[l.source] ?? 0) + 1;
      }
      return row;
    });

    // Trichter: wie viele Leads der Kohorte haben jede Phase erreicht
    const funnel = STAGES.map((stage, i) => ({
      label: stage.label,
      value: cohort.filter((l) => stageIndex(l.stage) >= i).length,
    }));

    const bySource = SOURCES.map((s) => {
      const items = cohort.filter((l) => l.source === s.id);
      const w = items.filter((l) => l.stage === "gewonnen" && l.status !== "verloren").length;
      return { id: s.id, label: s.label, value: items.length, won: w };
    }).filter((s) => s.value > 0);

    return { cohort, previous, won, lost, closeRate, cycle, pipelineValue, open, periods, perBucket, funnel, bySource };
  }, [leads, days]);

  const mrrMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const offset = i - 11;
        const { start } = monthRange(offset);
        return {
          short: start.toLocaleDateString("de-DE", { month: "short" }),
          long: start.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
          mrr: monthTotals(retainers ?? [], offset).mrr,
        };
      }),
    [retainers]
  );
  const mrrNow = mrrMonths[mrrMonths.length - 1]?.mrr ?? 0;
  const mrrBefore = mrrMonths[mrrMonths.length - 2]?.mrr ?? 0;

  const usedSources = SOURCES.filter((s) => stats.perBucket.some((row) => row[s.id]));
  const period = PERIODS.find((p) => p.days === days)!;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Analytics" meta={leads && `${stats.cohort.length} Leads · ${period.label}`}>
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 w-auto" aria-label="Zeitraum">
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </Select>
      </PageBar>

      {error ? (
        <Empty title="Daten konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Neue Leads" value={num(stats.cohort.length)}>
              <Delta current={stats.cohort.length} previous={stats.previous.length} label="vs. Vorperiode" />
            </Tile>
            <Tile label="Abschlussquote" value={stats.closeRate === null ? "–" : percent(stats.closeRate)}>
              <p className="mt-0.5 text-[12px] text-snow/45">
                {stats.won.length} gewonnen · {stats.lost.length} verloren
              </p>
            </Tile>
            <Tile label="Pipeline-Wert offen" value={euro(stats.pipelineValue)}>
              <p className="mt-0.5 text-[12px] text-snow/45">{stats.open.length} offene Leads, pro Monat</p>
            </Tile>
            <Tile label="Ø Tage bis Abschluss" value={stats.cycle === null ? "–" : num(Math.round(stats.cycle))}>
              <p className="mt-0.5 text-[12px] text-snow/45">von Anfrage bis gewonnen</p>
            </Tile>
            <Tile label="MRR aktuell" value={euro(mrrNow)}>
              <Delta current={mrrNow} previous={mrrBefore} label="vs. Vormonat" />
            </Tile>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title={days > 90 ? "Leads pro Monat nach Quelle" : "Leads pro Woche nach Quelle"}
              legend={usedSources.map((s) => ({ label: s.label, color: SOURCE_CHART_COLOR[s.id] }))}
              table={{
                head: [days > 90 ? "Monat" : "Woche", ...usedSources.map((s) => s.label), "Gesamt"],
                rows: stats.periods.map((b, i) => [
                  b.long,
                  ...usedSources.map((s) => stats.perBucket[i][s.id] ?? 0),
                  usedSources.reduce((sum, s) => sum + (stats.perBucket[i][s.id] ?? 0), 0),
                ]),
              }}
            >
              {usedSources.length === 0 ? (
                <Empty title="Keine Leads im Zeitraum" />
              ) : (
                <ColumnChart
                  ariaLabel="Neue Leads pro Zeitabschnitt, gestapelt nach Quelle"
                  labels={stats.periods.map((b) => b.short)}
                  tooltipLabels={stats.periods.map((b) => b.long)}
                  series={usedSources.map((s) => ({ key: s.id, label: s.label, color: SOURCE_CHART_COLOR[s.id] }))}
                  data={stats.perBucket}
                  format={(v) => `${num(v)} ${v === 1 ? "Lead" : "Leads"}`}
                  axisFormat={(v) => num(v)}
                />
              )}
            </ChartCard>

            <ChartCard
              title="Trichter"
              subtitle="Leads im Zeitraum, die die Phase erreicht haben"
              table={{
                head: ["Phase", "Leads", "Anteil"],
                rows: stats.funnel.map((f) => [f.label, f.value, stats.funnel[0].value ? percent(f.value / stats.funnel[0].value) : "–"]),
              }}
            >
              <BarList
                color={SERIES_1}
                format={num}
                rows={stats.funnel.map((f, i) => ({
                  label: f.label,
                  value: f.value,
                  note: i > 0 && stats.funnel[i - 1].value ? percent(f.value / stats.funnel[i - 1].value) : undefined,
                }))}
              />
              <p className="mt-3 text-[12px] text-snow/45">Prozent = Übergang aus der vorigen Phase</p>
            </ChartCard>

            <ChartCard
              title="Leads nach Quelle"
              subtitle="mit Anteil gewonnener Leads"
              table={{
                head: ["Quelle", "Leads", "Gewonnen", "Quote"],
                rows: stats.bySource.map((s) => [s.label, s.value, s.won, percent(s.won / s.value)]),
              }}
            >
              {stats.bySource.length === 0 ? (
                <Empty title="Keine Leads im Zeitraum" />
              ) : (
                <BarList
                  color={SERIES_1}
                  format={num}
                  rows={[...stats.bySource]
                    .sort((a, b) => b.value - a.value)
                    .map((s) => ({
                      label: s.label,
                      value: s.value,
                      color: SOURCE_CHART_COLOR[s.id as Source],
                      note: s.won ? `${s.won} gewonnen · ${percent(s.won / s.value)}` : undefined,
                    }))}
                />
              )}
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="MRR-Verlauf"
              subtitle="Letzte 12 Monate aus dem Auftragsbuch"
              table={{ head: ["Monat", "MRR"], rows: mrrMonths.map((m) => [m.long, euro(m.mrr)]) }}
            >
              <LineChart
                ariaLabel="Monatlich wiederkehrender Umsatz der letzten zwölf Monate"
                labels={mrrMonths.map((m) => m.short)}
                tooltipLabels={mrrMonths.map((m) => m.long)}
                values={mrrMonths.map((m) => m.mrr)}
                color={SERIES_1}
                label="MRR"
                format={euro}
              />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
