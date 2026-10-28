"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { TooltipBox } from "./chart-card";
import { compact, niceTicks } from "./theme";

// Handgebaute SVG-Diagramme nach den Mark-Specs der Dataviz-Methode:
// Säulen ≤ 24px mit 4px runder Datenkante, 2px Flächenlücke zwischen
// gestapelten Segmenten, 2px Linien, Hairline-Raster, Tooltip auf Hover und
// Fokus. Raster und Achsentext laufen über currentColor (Token snow), damit
// beide Farbmodi stimmen.

const M = { top: 10, right: 12, bottom: 24, left: 44 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Säule mit runder Datenkante oben, eckig an der Grundlinie. */
function columnPath(x: number, y: number, w: number, h: number, round: boolean) {
  if (h <= 0) return "";
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export type Series = { key: string; label: string; color: string };

type Hover = { index: number } | null;

function Axis({ ticks, y, width, format }: { ticks: number[]; y: (v: number) => number; width: number; format: (v: number) => string }) {
  return (
    <g className="text-snow" aria-hidden>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={M.left}
            x2={width - M.right}
            y1={y(t)}
            y2={y(t)}
            stroke="currentColor"
            strokeOpacity={t === 0 ? 0.22 : 0.08}
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.5} className="tabular-nums">
            {format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

function XLabels({ labels, x, band, height, every }: { labels: string[]; x: (i: number) => number; band: number; height: number; every: number }) {
  return (
    <g className="text-snow" aria-hidden>
      {labels.map((label, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={i} x={x(i) + band / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.5}>
            {label}
          </text>
        ) : null
      )}
    </g>
  );
}

/** Gestapelte (oder einfache) Säulen über Kategorien, optional mit Referenzlinie. */
export function ColumnChart({
  labels,
  tooltipLabels,
  series,
  data,
  format,
  axisFormat = compact,
  height = 220,
  reference,
  ariaLabel,
}: {
  labels: string[];
  tooltipLabels?: string[];
  series: Series[];
  data: Record<string, number>[];
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  height?: number;
  reference?: { value: number; label: string };
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover>(null);

  const totals = data.map((d) => series.reduce((sum, s) => sum + (d[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals, reference?.value ?? 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const band = labels.length ? innerW / labels.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const x = (i: number) => M.left + i * band;
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(innerW / 56))));

  return (
    <div ref={ref} className="relative" role="img" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          <Axis ticks={ticks} y={y} width={width} format={axisFormat} />
          {data.map((d, i) => {
            let base = 0;
            const visible = series.filter((s) => (d[s.key] ?? 0) > 0);
            return (
              <g key={i} opacity={hover && hover.index !== i ? 0.55 : 1} style={{ transition: "opacity 120ms" }}>
                {visible.map((s, k) => {
                  const value = d[s.key] ?? 0;
                  const y0 = y(base);
                  const y1 = y(base + value);
                  base += value;
                  const isTop = k === visible.length - 1;
                  // 2px Lücke zum nächsten Segment
                  const h = Math.max(0, y0 - y1 - (isTop ? 0 : 2));
                  return (
                    <path key={s.key} d={columnPath(x(i) + (band - barW) / 2, y0 - h, barW, h, isTop)} fill={s.color} />
                  );
                })}
              </g>
            );
          })}
          {reference && (
            <g className="text-snow" aria-hidden>
              <line
                x1={M.left}
                x2={width - M.right}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke="currentColor"
                strokeOpacity={0.7}
                strokeWidth={1.5}
              />
              <text x={width - M.right} y={y(reference.value) - 6} textAnchor="end" fontSize={11} fill="currentColor" fillOpacity={0.75}>
                {reference.label}
              </text>
            </g>
          )}
          <XLabels labels={labels} x={x} band={band} height={height} every={every} />
          {/* Trefferflächen: ganze Spalte, größer als die Säule */}
          {labels.map((label, i) => (
            <rect
              key={i}
              x={x(i)}
              y={M.top}
              width={band}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${tooltipLabels?.[i] ?? label}: ${format(totals[i])}`}
              className="cursor-default outline-none focus-visible:stroke-snow/40"
              onPointerEnter={() => setHover({ index: i })}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover({ index: i })}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      {hover && width > 0 && (
        <TooltipBox
          title={tooltipLabels?.[hover.index] ?? labels[hover.index]}
          rows={[
            ...(series.length > 1 ? [{ label: "Gesamt", value: format(totals[hover.index]) }] : []),
            ...series
              .filter((s) => (data[hover.index][s.key] ?? 0) > 0 || series.length === 1)
              .map((s) => ({ label: s.label, value: format(data[hover.index][s.key] ?? 0), color: s.color })),
          ]}
          style={{
            left: Math.min(Math.max(0, x(hover.index) + band / 2 - 72), width - 160),
            top: 0,
          }}
        />
      )}
    </div>
  );
}

/** Eine Reihe als Linie mit Flächen-Wash, Fadenkreuz und Endwert. */
export function LineChart({
  labels,
  tooltipLabels,
  values,
  color,
  label,
  format,
  axisFormat = compact,
  height = 220,
  ariaLabel,
}: {
  labels: string[];
  tooltipLabels?: string[];
  values: number[];
  color: string;
  label: string;
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<Hover>(null);
  const max = Math.max(1, ...values);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const band = labels.length ? innerW / labels.length : 0;
  const x = (i: number) => M.left + i * band;
  const cx = (i: number) => x(i) + band / 2;
  const y = (v: number) => M.top + innerH - (v / top) * innerH;
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(innerW / 56))));
  const line = values.map((v, i) => `${i ? "L" : "M"}${cx(i)},${y(v)}`).join("");
  const area = values.length ? `${line}L${cx(values.length - 1)},${y(0)}L${cx(0)},${y(0)}Z` : "";
  const last = values.length - 1;

  return (
    <div ref={ref} className="relative" role="img" aria-label={ariaLabel}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          <Axis ticks={ticks} y={y} width={width} format={axisFormat} />
          <path d={area} fill={color} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover && (
            <line
              x1={cx(hover.index)}
              x2={cx(hover.index)}
              y1={M.top}
              y2={M.top + innerH}
              className="text-snow"
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1}
            />
          )}
          {last >= 0 && (
            <>
              {/* Endpunkt mit 2px Ring in Flächenfarbe und Endwert */}
              <circle cx={cx(hover?.index ?? last)} cy={y(values[hover?.index ?? last])} r={5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
              {!hover && (
                <text
                  x={cx(last) - 8}
                  y={y(values[last]) - 10}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={600}
                  className="text-snow"
                  fill="currentColor"
                >
                  {format(values[last])}
                </text>
              )}
            </>
          )}
          <XLabels labels={labels} x={x} band={band} height={height} every={every} />
          {labels.map((l, i) => (
            <rect
              key={i}
              x={x(i)}
              y={M.top}
              width={band}
              height={innerH}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${tooltipLabels?.[i] ?? l}: ${format(values[i])}`}
              className="outline-none"
              onPointerEnter={() => setHover({ index: i })}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover({ index: i })}
              onBlur={() => setHover(null)}
            />
          ))}
        </svg>
      )}
      {hover && width > 0 && (
        <TooltipBox
          title={tooltipLabels?.[hover.index] ?? labels[hover.index]}
          rows={[{ label, value: format(values[hover.index]), color }]}
          style={{ left: Math.min(Math.max(0, cx(hover.index) - 72), width - 160), top: 0 }}
        />
      )}
    </div>
  );
}

/** Horizontale Balken (eine Reihe), Wert an der Spitze. */
export function BarList({
  rows,
  color,
  format,
  className,
}: {
  rows: { label: string; value: number; note?: string; color?: string }[];
  color: string;
  format: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[minmax(84px,auto)_1fr] items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1.5 truncate text-snow/70">
            {row.color && <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: row.color }} />}
            {row.label}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="h-[18px] rounded-r-[4px]"
              style={{ width: `${Math.max(row.value > 0 ? 1.5 : 0, (row.value / max) * 78)}%`, background: row.color ?? color }}
              title={`${row.label}: ${format(row.value)}`}
            />
            <span className="shrink-0 font-medium text-snow tabular-nums">{format(row.value)}</span>
            {row.note && <span className="shrink-0 truncate text-snow/45">{row.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
