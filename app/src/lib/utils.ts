import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(d: Date | string, locale = "th-TH") {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function safeJsonParse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/**
 * Human-friendly "5 นาทีที่แล้ว" style relative timestamp. Falls back
 * to the absolute date via `formatDate` once the gap exceeds a week —
 * past that point "57,231 minutes ago" is less useful than "18 May 09:02".
 *
 * Uses `Intl.RelativeTimeFormat` so the locale-specific phrasing
 * matches the rest of the app (Thai default).
 */
export function formatRelativeTime(
  d: Date | string,
  locale = "th-TH",
  now: Date = new Date(),
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absSec < 60) return rtf.format(diffSec, "second");
  if (absSec < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (absSec < 86_400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (absSec < 7 * 86_400) return rtf.format(Math.round(diffSec / 86_400), "day");
  return formatDate(date, locale);
}
