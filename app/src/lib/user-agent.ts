/**
 * Tiny user-agent parser used by the metrics dashboard to classify recorded
 * AuditLog rows as "mobile" or "desktop" sessions. We deliberately avoid
 * `ua-parser-js` here — a regex covers our user base (Thai users on
 * Android/iOS, plus the in-app LINE WebView) well enough for milestone 1
 * baseline accuracy, and skipping the dependency keeps the bundle small
 * and the prod surface area limited. Revisit if false-positive rate
 * climbs in milestone 5.
 */
export type DeviceFamily = "ios" | "android" | "line" | "other-mobile" | "desktop";

export interface UAClassification {
  isMobile: boolean;
  family: DeviceFamily;
}

const MOBILE_RE = /Mobi|Android|iPhone|iPad|iPod|Line\//i;

export function parseUA(ua: string | null | undefined): UAClassification {
  if (!ua) return { isMobile: false, family: "desktop" };
  if (/Line\//i.test(ua)) return { isMobile: true, family: "line" };
  if (/iPhone|iPad|iPod/i.test(ua)) return { isMobile: true, family: "ios" };
  if (/Android/i.test(ua)) return { isMobile: true, family: "android" };
  if (MOBILE_RE.test(ua)) return { isMobile: true, family: "other-mobile" };
  return { isMobile: false, family: "desktop" };
}
