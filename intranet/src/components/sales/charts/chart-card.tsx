"use client";

import { useState } from "react";
import { Table2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { CHART_VARS_CSS } from "./theme";

export type LegendItem = { label: string; color: string; kind?: "rect" | "line" };

/** Rahmen für ein Diagramm: Titel, Legende, Diagramm und Tabellenansicht
 * (jeder Wert ist auch ohne Hover erreichbar). */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  legend?: LegendItem[];
  table?: { head: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={cn("viz-root flex min-w-0 flex-col rounded-2xl border border-snow/[0.06] bg-surface p-4", className)}>
      <style href="grid-chart-vars" precedence="default">{CHART_VARS_CSS}</style>
      <header className="mb-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-medium">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-snow/50">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-snow/55 hover:bg-snow/[0.08] hover:text-snow",
              showTable && "bg-snow/[0.1] text-snow"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            Tabelle
          </button>
        )}
      </header>
      {legend && legend.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-snow/70">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              {item.kind === "line" ? (
                <span className="h-0.5 w-3.5 rounded-full" style={{ background: item.color }} />
              ) : (
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
              )}
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {showTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead>
              <tr className="text-left text-snow/50">
                {table.head.map((h, i) => (
                  <th key={h} className={cn("py-1.5 pr-3 font-medium", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r} className="border-t border-snow/[0.06]">
                  {row.map((cell, i) => (
                    <td key={i} className={cn("py-1.5 pr-3", i > 0 ? "text-right text-snow/85" : "text-snow/70")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** Tooltip-Inhalt: Wert stark, Reihenname dahinter, Linien-Key in Reihenfarbe. */
export function TooltipBox({
  title,
  rows,
  style,
}: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
  style: React.CSSProperties;
}) {
  return (
    <div
      role="status"
      className="glass-solid pointer-events-none absolute z-10 min-w-36 rounded-xl px-3 py-2 text-[12px]"
      style={style}
    >
      <p className="mb-1 text-snow/55">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-center gap-2">
          {row.color && <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} />}
          <span className="font-semibold text-snow tabular-nums">{row.value}</span>
          <span className="text-snow/60">{row.label}</span>
        </p>
      ))}
    </div>
  );
}
