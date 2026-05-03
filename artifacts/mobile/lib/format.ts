import type { Lang } from "./i18n";

export function formatCurrency(
  amount: number | string | null | undefined,
  lang: Lang,
  currency: string = "AED",
): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || Number.isNaN(n)) return lang === "ar" ? "—" : "—";
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-AE" : "en-AE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

export function formatDate(
  iso: string | Date | null | undefined,
  lang: Lang,
): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-AE" : "en-AE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export function timeAgo(
  iso: string | Date | null | undefined,
  lang: Lang,
): string {
  if (!iso) return "";
  const d = iso instanceof Date ? iso : new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (lang === "ar") {
    if (sec < 60) return "الآن";
    if (min < 60) return `قبل ${min} د`;
    if (hr < 24) return `قبل ${hr} س`;
    if (day < 30) return `قبل ${day} يوم`;
    return formatDate(d, lang);
  }
  if (sec < 60) return "now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 30) return `${day}d ago`;
  return formatDate(d, lang);
}
