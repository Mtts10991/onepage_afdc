import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * next-intl v4 — getRequestConfig ต้อง return { locale, messages }
 * ของเราไม่มี locale segment ใน URL → อ่านจาก cookie "locale" (default = th)
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // ลองอ่านจาก URL/segment ก่อน (next-intl อาจส่งมา)
  const fromRequest = await requestLocale;

  let locale: Locale = defaultLocale;
  if (fromRequest && (locales as readonly string[]).includes(fromRequest)) {
    locale = fromRequest as Locale;
  } else {
    const cookieStore = await cookies();
    const raw = cookieStore.get("locale")?.value;
    if (raw && (locales as readonly string[]).includes(raw)) {
      locale = raw as Locale;
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
