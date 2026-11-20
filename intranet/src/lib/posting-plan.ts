import type { PostProvider, SocialPost } from "@/lib/marketing";

// Postingplan je Kundenwelt (aus dem Agenturvertrag): wie viele Beiträge,
// Reels, Fotoposts, Karussells und Storys pro Woche bzw. Monat geschuldet
// sind, oder ein Rhythmus („alle 2 Tage“). Gezählt wird, was eingeplant ist:
// geplante und veröffentlichte Posts sowie Entwürfe mit Termin (die als
// „offen“ markiert werden, bis sie freigegeben sind).

export type QuotaKind = "beitrag" | "reel" | "foto" | "karussell" | "story";
export type QuotaPeriod = "week" | "month" | "days";

export type PlanRule = {
  kind: QuotaKind;
  /** Mindestmenge je Zeitraum (bei „days“: 1 Post je Zeitraum) */
  count: number;
  /** Obergrenze bei Spannen wie „3–4 Posts pro Woche“ */
  max?: number | null;
  period: QuotaPeriod;
  /** Nur bei period "days": alle N Tage */
  every?: number | null;
};

export type PostingPlan = {
  rules: PlanRule[];
  /** E-Mail der zuständigen Person (bekommt die Erinnerungen) */
  owner: string | null;
  /** Ab wann der volle Umfang gilt (YYYY-MM-DD) */
  start: string | null;
  platforms: PostProvider[];
  notes: string;
  source: { name: string; at: string } | null;
};

export const EMPTY_PLAN: PostingPlan = { rules: [], owner: null, start: null, platforms: [], notes: "", source: null };

export const QUOTA_KINDS: Record<QuotaKind, { label: string; one: string; text: string }> = {
  beitrag: { label: "Beiträge", one: "Beitrag", text: "Alle Feed-Beiträge (Bild, Karussell, Reel)" },
  reel: { label: "Reels", one: "Reel", text: "Feed-Beiträge mit Video" },
  foto: { label: "Fotoposts", one: "Fotopost", text: "Feed-Beiträge mit Bild oder Karussell" },
  karussell: { label: "Karussells", one: "Karussell", text: "Beiträge mit mehreren Bildern" },
  story: { label: "Storys", one: "Story", text: "Storys" },
};
export const QUOTA_KIND_LIST = Object.keys(QUOTA_KINDS) as QuotaKind[];
export const PERIOD_LABELS: Record<QuotaPeriod, string> = { week: "pro Woche", month: "pro Monat", days: "Rhythmus" };

// ---------- Zeit in Berlin ----------

const berlinDay = (date: Date | string | number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));

/** Kalendertag als UTC-Mittag (rechnen ohne Zeitzonen-Sprünge) */
const noon = (day: string) => new Date(`${day}T12:00:00Z`);
const shiftDay = (day: string, days: number) => {
  const d = noon(day);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** ISO-Kalenderwoche eines Tages */
export function isoWeekOf(day: string) {
  const d = noon(day);
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday + 3);
  const year = d.getUTCFullYear();
  const first = new Date(Date.UTC(year, 0, 4, 12));
  const week = 1 + Math.round(((d.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return { year, week };
}

export type PlanWindow = { period: "week" | "month"; from: string; to: string; label: string };

/** Woche (Mo–So) bzw. Monat, in dem der Tag liegt */
export function windowOf(period: "week" | "month", date: Date | string = new Date()): PlanWindow {
  const day = berlinDay(date);
  if (period === "week") {
    const weekday = (noon(day).getUTCDay() + 6) % 7;
    const from = shiftDay(day, -weekday);
    return { period, from, to: shiftDay(from, 6), label: `KW ${isoWeekOf(from).week}` };
  }
  const from = `${day.slice(0, 7)}-01`;
  const next = noon(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  const to = next.toISOString().slice(0, 10);
  return { period, from, to, label: noon(from).toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" }) };
}

const daysIn = (w: PlanWindow) => Math.round((noon(w.to).getTime() - noon(w.from).getTime()) / 86_400_000) + 1;

// ---------- Zählen ----------

const COUNTED = new Set(["scheduled", "publishing", "published", "partial"]);

/** Termin des Posts (veröffentlicht oder geplant) */
const postDay = (post: SocialPost) => {
  const at = post.published_at ?? post.scheduled_at;
  return at ? berlinDay(at) : null;
};

/** Zählt der Post für den Plan? „fest“ = geplant/online, „offen“ = Entwurf mit Termin */
function state(post: SocialPost): "fest" | "offen" | null {
  if (COUNTED.has(post.status)) return "fest";
  if (post.status === "draft" && post.scheduled_at) return "offen";
  return null;
}

export function matches(post: SocialPost, kind: QuotaKind) {
  const story = post.format === "story";
  if (kind === "story") return story;
  if (story) return false;
  const video = post.media.some((m) => m.kind === "video");
  if (kind === "reel") return video;
  if (kind === "foto") return !video;
  if (kind === "karussell") return post.format === "carousel" || post.media.filter((m) => m.kind === "image").length > 1;
  return true;
}

export type RuleProgress = {
  rule: PlanRule;
  window: PlanWindow;
  /** Soll im Zeitraum (bei Rhythmus aus der Länge berechnet) */
  required: number;
  max: number | null;
  /** geplant/veröffentlicht */
  done: number;
  /** Entwürfe mit Termin (noch nicht freigegeben) */
  open: number;
  missing: number;
};

/** Soll und Stand einer Regel im Zeitraum */
export function progress(rule: PlanRule, posts: SocialPost[], window: PlanWindow): RuleProgress {
  let done = 0;
  let open = 0;
  for (const post of posts) {
    const day = postDay(post);
    if (!day || day < window.from || day > window.to || !matches(post, rule.kind)) continue;
    const s = state(post);
    if (s === "fest") done++;
    else if (s === "offen") open++;
  }
  const required = rule.period === "days" ? Math.ceil(daysIn(window) / Math.max(1, rule.every ?? 1)) : rule.count;
  return { rule, window, required, max: rule.period === "days" ? null : rule.max ?? null, done, open, missing: Math.max(0, required - done - open) };
}

/** Regeln, die zum Zeitraum passen: Wochenregeln zur Woche, Monatsregeln zum Monat, Rhythmus zu beiden */
export function rulesFor(plan: PostingPlan, period: "week" | "month") {
  return plan.rules.filter((r) => r.period === period || r.period === "days");
}

/** Tage ohne passenden Post im Rhythmus („alle N Tage“), ab heute */
export function gaps(rule: PlanRule, posts: SocialPost[], from = berlinDay(new Date()), days = 14): string[] {
  if (rule.period !== "days" || !rule.every) return [];
  const planned = new Set(posts.filter((p) => state(p) && matches(p, rule.kind)).map(postDay).filter((d): d is string => !!d));
  const result: string[] = [];
  // Ein Fenster von N Tagen ohne Post ist eine Lücke; gemeldet wird sein letzter Tag
  let since = 0;
  for (let i = 0; i < days; i++) {
    const day = shiftDay(from, i);
    since = planned.has(day) ? 0 : since + 1;
    if (since >= rule.every) {
      result.push(day);
      since = 0;
    }
  }
  return result;
}

export const ruleText = (rule: PlanRule) => {
  const kind = QUOTA_KINDS[rule.kind];
  if (rule.period === "days") return `${kind.one} alle ${rule.every ?? 1} Tage`;
  const amount = rule.max && rule.max > rule.count ? `${rule.count}–${rule.max}` : `${rule.count}`;
  return `${amount} ${rule.count === 1 && !rule.max ? kind.one : kind.label} ${PERIOD_LABELS[rule.period]}`;
};

/** Plan säubern (aus Formular oder Claude) */
export function cleanPlan(input: Partial<PostingPlan> | null | undefined): PostingPlan {
  const int = (v: unknown, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : null;
  };
  const rules = (Array.isArray(input?.rules) ? input.rules : [])
    .filter((r) => r && QUOTA_KIND_LIST.includes(r.kind) && ["week", "month", "days"].includes(r.period))
    .slice(0, 12)
    .map((r) => {
      const count = int(r.count, 1, 200) ?? 1;
      const max = int(r.max, 0, 200);
      return {
        kind: r.kind,
        period: r.period,
        count: r.period === "days" ? 1 : count,
        max: r.period !== "days" && max && max > count ? max : null,
        every: r.period === "days" ? int(r.every, 1, 31) ?? 2 : null,
      } satisfies PlanRule;
    });
  const platforms = (Array.isArray(input?.platforms) ? input.platforms : []).filter((p): p is PostProvider => ["instagram", "facebook", "tiktok", "linkedin"].includes(p));
  const start = typeof input?.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.start) ? input.start : null;
  const owner = typeof input?.owner === "string" && input.owner.includes("@") ? input.owner.trim().toLowerCase() : null;
  const source = input?.source && typeof input.source.name === "string" ? { name: input.source.name.slice(0, 200), at: String(input.source.at ?? new Date().toISOString()) } : null;
  return { rules, owner, start, platforms: [...new Set(platforms)], notes: typeof input?.notes === "string" ? input.notes.trim().slice(0, 2000) : "", source };
}
