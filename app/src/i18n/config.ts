export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";
export const localeNames: Record<Locale, string> = {
  th: "ไทย",
  en: "English",
};
