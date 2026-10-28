const euroFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export const euro = (value: number | null | undefined) =>
  value === null || value === undefined ? "–" : euroFormat.format(value);

export const num = (value: number) => numberFormat.format(value);

export const percent = (value: number) =>
  `${numberFormat.format(Math.round(value * 1000) / 10)} %`;

export function formatDate(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "–";
  return new Date(value).toLocaleDateString("de-DE", options ?? { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** „gerade eben“, „vor 5 Min.“, „vor 3 T.“ … */
export function relativeTime(value: string | Date) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days < 30) return `vor ${days} T.`;
  const months = Math.round(days / 30);
  if (months < 12) return `vor ${months} Mon.`;
  return `vor ${Math.round(months / 12)} J.`;
}

/** Datum als yyyy-mm-dd (lokale Zeit) für <input type="date"> */
export function isoDate(value: string | Date | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
