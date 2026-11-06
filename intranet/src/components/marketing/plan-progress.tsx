"use client";

import Link from "next/link";
import { CalendarRange, Settings2 } from "lucide-react";
import { useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import type { SocialPost } from "@/lib/marketing";
import { gaps, progress, QUOTA_KINDS, rulesFor, windowOf, type PostingPlan, type RuleProgress } from "@/lib/posting-plan";

// Fortschritt laut Postingplan im Planer: für die angezeigte Woche und ihren
// Monat, z. B. „Beiträge 2/3–4 · Storys 6/10“. Grün = erfüllt, hell = mit
// offenen Entwürfen erfüllt, sonst fehlt noch etwas.

export function PlanProgress({ workspaceId, posts, anchor, view }: { workspaceId: string; posts: SocialPost[]; anchor: Date; view: "week" | "month" }) {
  const { data: plan } = useResource<PostingPlan>(`/api/marketing/workspaces/${workspaceId}/posting-plan`);
  if (!plan?.rules.length) return null;
  const windows = view === "week" ? [windowOf("week", anchor), windowOf("month", anchor)] : [windowOf("month", anchor)];
  const rows = windows
    .map((window) => ({
      window,
      items: rulesFor(plan, window.period)
        .filter((rule) => !(window.period === "month" && rule.period === "days" && view === "week"))
        .map((rule) => progress(rule, posts, window)),
    }))
    .filter((row) => row.items.length);
  const holes = plan.rules.flatMap((rule) => gaps(rule, posts)).sort();
  const before = plan.start && windows[0].to < plan.start;

  return (
    <section aria-label="Postingplan" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-snow/[0.06] bg-surface px-4 py-3 shadow-[0_1px_2px_var(--shadow-color),0_2px_8px_var(--shadow-color)]">
      <span className="flex items-center gap-2 text-[13px] font-semibold">
        <CalendarRange className="h-4 w-4 text-snow/60" /> Postingplan
      </span>
      {before ? (
        <span className="text-[12.5px] text-snow/55">Voller Umfang ab {new Date(`${plan.start}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })}</span>
      ) : (
        rows.map(({ window, items }) => (
          <span key={window.from + window.period} className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-snow/50">{window.label}</span>
            {items.map((item) => (
              <Chip key={`${item.rule.kind}-${item.rule.period}`} item={item} />
            ))}
          </span>
        ))
      )}
      {!before && holes.length > 0 && (
        <span className="text-[12px] font-medium" style={{ color: "#d9822b" }}>
          Lücke ab {new Date(`${holes[0]}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" })}
        </span>
      )}
      <Link href={`/akte/${workspaceId}/einstellungen/postingplan`} className="ml-auto grid h-8 w-8 place-items-center rounded-full text-snow/50 hover:bg-snow/[0.06] hover:text-snow" aria-label="Postingplan bearbeiten" title="Postingplan bearbeiten">
        <Settings2 className="h-4 w-4" />
      </Link>
    </section>
  );
}

function Chip({ item }: { item: RuleProgress }) {
  const total = item.done + item.open;
  const met = item.done >= item.required;
  const withDrafts = !met && total >= item.required;
  const target = item.max && item.max > item.required ? `${item.required}–${item.max}` : `${item.required}`;
  return (
    <span
      title={`${QUOTA_KINDS[item.rule.kind].text}: ${item.done} eingeplant${item.open ? `, ${item.open} Entwurf mit Termin` : ""}, Soll ${target}`}
      className={clsx(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium tabular-nums",
        met ? "bg-[#30a46c]/15 text-[#2a8f5e]" : withDrafts ? "bg-snow/[0.08] text-snow/80" : "bg-[#d9822b]/15 text-[#b8691d]"
      )}
    >
      {QUOTA_KINDS[item.rule.kind].label}
      {item.rule.period === "days" && <span className="opacity-70">· alle {item.rule.every} Tage</span>}
      <span>
        {total}/{target}
      </span>
      {item.open > 0 && <span className="text-[10.5px] opacity-70">({item.open} offen)</span>}
    </span>
  );
}
