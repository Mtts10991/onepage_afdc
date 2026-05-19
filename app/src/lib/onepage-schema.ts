import { z } from "zod";

/**
 * โครงข้อมูล OnePage — 2 template
 *  - plan   : แผนโครงการ (objective/KPI/budget/timeline)
 *  - report : รายงานกิจกรรม (header + image grid + paragraph + footer)
 *
 * ปรับ field ที่นี่ที่เดียว — form/preview/export อ่านจากที่นี่
 */

export const onepageTypeSchema = z.enum(["plan", "report"]);
export type OnePageType = z.infer<typeof onepageTypeSchema>;

// ---------- PLAN ----------
export const onepageActivitySchema = z.object({
  name: z.string().default(""),
  period: z.string().default(""),
  status: z.string().default(""),
});

export const onepageKpiSchema = z.object({
  name: z.string().default(""),
  target: z.string().default(""),
});

export const onepagePlanDataSchema = z.object({
  type: z.literal("plan").default("plan"),
  agency: z.string().default(""),
  logoUrl: z.string().nullable().default(null),
  projectName: z.string().default(""),
  date: z.string().default(""),
  background: z.string().default(""),
  objective: z.string().default(""),
  scope: z.string().default(""),
  targetGroup: z.string().default(""),
  responsible: z.string().default(""),
  budget: z.string().default(""),
  timeline: z.string().default(""),
  kpis: z.array(onepageKpiSchema).default([]),
  activities: z.array(onepageActivitySchema).default([]),
  outcome: z.string().default(""),
  imageUrl: z.string().nullable().default(null),
  accentColor: z.string().nullable().default(null),
  // Optional ISO date (YYYY-MM-DD) — only set when the plan has a real
  // due date. Surfaces a 24h-prior LINE reminder to the owner via the
  // notify-deadlines cron. Report-type onepages don't carry a deadline
  // because they describe past events.
  //
  // Validation: empty / null is fine (no deadline set). When set it must
  // be parseable as a date; we DON'T enforce future-only here because
  // historical plans being archived can have past deadlines legitimately.
  deadline: z
    .string()
    .nullable()
    .default(null)
    .refine(
      (v) => v === null || v === "" || isPlausibleIsoDate(v),
      { message: "deadline_invalid_iso_date" },
    ),
});

/**
 * Loose ISO-8601 date check accepting `YYYY-MM-DD` (date input) and
 * full datetime strings. Empty/null are accepted upstream — only call
 * this when there's a real value to validate.
 */
function isPlausibleIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)) {
    return false;
  }
  const t = Date.parse(s);
  return Number.isFinite(t);
}

// ---------- REPORT ----------
// Typography overrides — narrowed to a sensible PT range so the layout
// can't be broken by a 9999px font, and `coerce` lets old onepages with
// `undefined` survive parsing without manual migration.
const fontSize = (defaultPt: number) =>
  z.coerce.number().min(8).max(48).default(defaultPt);

export const onepageReportDataSchema = z.object({
  type: z.literal("report").default("report"),

  // header — typography defaults intentionally bold + larger to match the
  // government print template the field team showed us.
  agencyName: z.string().default(""),     // บรรทัดที่ 1 ชื่อหน่วย
  agencyNameFontSize: fontSize(25),       // pt — preview is in px, scaled below
  agencyNameBold: z.boolean().default(true),
  subAgency: z.string().default(""),      // บรรทัดที่ 2 หน่วยงานย่อย
  subAgencyFontSize: fontSize(16),
  subAgencyBold: z.boolean().default(true),
  dateLine: z.string().default(""),       // บรรทัดที่ 3 "ประจำวัน..." (auto-generated)
  dateIso: z.string().default(""),        // raw date YYYY-MM-DD (source of truth)
  dateColor: z.string().default("#06aeb1"),
  leftLogoUrl: z.string().nullable().default(null),
  rightLogoUrl: z.string().nullable().default(null),

  // body
  images: z.array(z.string()).default([]),    // รูปกิจกรรม URLs
  paragraph: z.string().default(""),          // plain text (backward compat)
  paragraphHtml: z.string().default(""),      // rich text (Tiptap output)

  // footer (2 columns: website + facebook)
  websiteQrUrl: z.string().nullable().default(null),
  websiteLabel: z.string().default(""),       // เว็บไซต์ URL หรือชื่อ
  facebookQrUrl: z.string().nullable().default(null),
  facebookLabel: z.string().default(""),

  // legacy single QR (backward compat — ใหม่ใช้ websiteQrUrl)
  qrUrl: z.string().nullable().default(null),
  slogan: z.string().default("เทิดทูนชาติ ทันสมัย พัฒนา"),
  sloganFontSize: fontSize(24),
  sloganBold: z.boolean().default(true),
  facebook: z.string().default(""),
  youtube: z.string().default(""),
  twitter: z.string().default(""),

  // theme (single primary color — derive header/footer/frame/slogan จากค่านี้)
  primaryColor: z.string().default("#1e3a7a"),

  // legacy (เก็บไว้ backward compat แต่ไม่ใช้แล้ว)
  headerColor: z.string().default("#1e3a7a"),
  headerAccentColor: z.string().default("#1e3a7a"),
  footerColor: z.string().default("#1e3a7a"),
  sloganColor: z.string().default("#14245a"),
});

// ---------- UNION ----------
export const onepageDataSchema = z.discriminatedUnion("type", [
  onepagePlanDataSchema,
  onepageReportDataSchema,
]);

export type OnePagePlanData = z.infer<typeof onepagePlanDataSchema>;
export type OnePageReportData = z.infer<typeof onepageReportDataSchema>;
export type OnePageData = z.infer<typeof onepageDataSchema>;
export type OnePageActivity = z.infer<typeof onepageActivitySchema>;
export type OnePageKpi = z.infer<typeof onepageKpiSchema>;

export const defaultPlanData: OnePagePlanData = {
  type: "plan",
  agency: "",
  logoUrl: null,
  projectName: "",
  date: "",
  background: "",
  objective: "",
  scope: "",
  targetGroup: "",
  responsible: "",
  budget: "",
  timeline: "",
  kpis: [],
  activities: [],
  outcome: "",
  imageUrl: null,
  accentColor: null,
  deadline: null,
};

/**
 * Bundled assets served from `/public/defaults/`. New activity-report
 * onepages start with these pre-filled so a typical first-time user can
 * preview the layout immediately and only swap them if their unit differs.
 * Users can still override every field via the image picker in the form.
 *
 * Logos are 400×400 RGBA PNG (1×1 inch @ 300 DPI, transparent background).
 * QR codes are also raster images shipped alongside the logos so the
 * default report renders with usable footer icons out of the box.
 */
export const DEFAULT_LEFT_LOGO_URL = "/defaults/logo1.png";
export const DEFAULT_RIGHT_LOGO_URL = "/defaults/logo2.png";
export const DEFAULT_WEBSITE_QR_URL = "/defaults/qr-chrome.png";
export const DEFAULT_FACEBOOK_QR_URL = "/defaults/qr-facebook.png";

/**
 * Curated colour palette for the date line. Picked to read as "ราชการ" but
 * lighter than the default header blue so the date stays visually distinct.
 */
export const DEFAULT_DATE_COLOR = "#06aeb1";

export const defaultReportData: OnePageReportData = {
  type: "report",
  agencyName: "",
  // Header typography defaults — see report-form / preview / export-pptx
  // for how they're applied. 25 pt + bold matches the chosen government
  // print spec for line 1.
  agencyNameFontSize: 25,
  agencyNameBold: true,
  subAgency: "",
  subAgencyFontSize: 16,
  subAgencyBold: true,
  dateLine: "",
  dateIso: "",
  dateColor: DEFAULT_DATE_COLOR,
  leftLogoUrl: DEFAULT_LEFT_LOGO_URL,
  rightLogoUrl: DEFAULT_RIGHT_LOGO_URL,
  images: [],
  paragraph: "",
  paragraphHtml: "",
  websiteQrUrl: DEFAULT_WEBSITE_QR_URL,
  websiteLabel: "",
  facebookQrUrl: DEFAULT_FACEBOOK_QR_URL,
  facebookLabel: "",
  qrUrl: null,
  slogan: "เทิดราชัน·ทันสมัย·พัฒนา",
  sloganFontSize: 24,
  sloganBold: true,
  facebook: "",
  youtube: "",
  twitter: "",
  primaryColor: "#1e3a7a",
  headerColor: "#1e3a7a",
  headerAccentColor: "#1e3a7a",
  footerColor: "#1e3a7a",
  sloganColor: "#14245a",
};

export function defaultDataFor(type: OnePageType): OnePageData {
  return type === "report" ? defaultReportData : defaultPlanData;
}

export function parseOnePageData(data: string | null | undefined): OnePageData {
  if (!data) return defaultPlanData;
  try {
    const parsed = JSON.parse(data);
    // backward compat: ข้อมูลเก่าไม่มี type → ถือว่าเป็น plan
    if (!parsed.type) parsed.type = "plan";
    return onepageDataSchema.parse(parsed);
  } catch {
    return defaultPlanData;
  }
}
