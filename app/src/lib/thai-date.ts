/**
 * แปลง ISO date string (YYYY-MM-DD) → "ประจำวัน[X]ที่ DD MMMM YYYY (พ.ศ.)"
 * เช่น 2026-03-31 → "ประจำวันอังคารที่ 31 มีนาคม 2569"
 */

const THAI_DAYS = [
  "อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์",
] as const;

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
] as const;

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const;

export function parseIsoDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

/** "ประจำวันอังคารที่ 31 มีนาคม 2569" */
export function formatThaiDateLine(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return "";
  const day = THAI_DAYS[d.getDay()];
  const date = d.getDate();
  const month = THAI_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `ประจำวัน${day}ที่ ${date} ${month} ${year}`;
}

/** สั้น "31 มี.ค. 69" */
export function formatThaiDateShort(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return "";
  const date = d.getDate();
  const month = THAI_MONTHS_SHORT[d.getMonth()];
  const year = (d.getFullYear() + 543) % 100;
  return `${date} ${month} ${year}`;
}

/** "31 มีนาคม 2569" (สำหรับ caption เนื้อหา) */
export function formatThaiDateLong(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return "";
  const date = d.getDate();
  const month = THAI_MONTHS[d.getMonth()];
  const year = d.getFullYear() + 543;
  return `${date} ${month} ${year}`;
}

/** วันนี้ในรูป ISO (yyyy-mm-dd) — สำหรับ default ของ <input type="date"> */
export function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
