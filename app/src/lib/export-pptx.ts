import PPTXGen from "pptxgenjs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type {
  OnePageData,
  OnePagePlanData,
  OnePageReportData,
} from "./onepage-schema";
import { sanitizeRichHtml } from "./sanitize-html";
import { htmlToTextRuns } from "./tiptap-to-pptx";

export async function exportOnePagePptx(
  title: string,
  data: OnePageData
): Promise<Buffer> {
  if (data.type === "report") return exportReportPptx(title, data);
  return exportPlanPptx(title, data);
}

// ====================================================================
//  PLAN — แผนโครงการ
// ====================================================================
async function exportPlanPptx(title: string, data: OnePagePlanData): Promise<Buffer> {
  const pptx = new PPTXGen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.defineSlideMaster({ title: "Master", background: { color: "FFFFFF" } });
  const slide = pptx.addSlide();
  const accent = (data.accentColor ?? "#1d4ed8").replace("#", "");

  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.7, fill: { color: accent }, line: { color: accent } });

  if (data.logoUrl) {
    const img = await loadImage(data.logoUrl);
    if (img) slide.addImage({ data: img.dataUrl, x: 0.25, y: 0.1, w: 0.5, h: 0.5 });
  }

  slide.addText(data.agency || "", { x: 0.85, y: 0.05, w: 8, h: 0.35, fontFace: "Sarabun", fontSize: 16, bold: true, color: "FFFFFF" });
  slide.addText(title || "", { x: 0.85, y: 0.36, w: 8, h: 0.3, fontFace: "Sarabun", fontSize: 11, color: "FFFFFF" });
  slide.addText(data.date || "", { x: 10.5, y: 0.18, w: 2.5, h: 0.35, fontFace: "Sarabun", fontSize: 12, color: "FFFFFF", align: "right" });

  slide.addShape("rect", { x: 0, y: 0.7, w: 13.333, h: 0.65, fill: { color: lighten(accent, 0.15) }, line: { color: lighten(accent, 0.15) } });
  slide.addText(data.projectName || "ชื่อโครงการ", { x: 0.3, y: 0.72, w: 12.7, h: 0.6, fontFace: "Sarabun", fontSize: 22, bold: true, color: "FFFFFF" });

  const leftItems = [
    ["ความเป็นมา", data.background],
    ["วัตถุประสงค์", data.objective],
    ["ขอบเขต", data.scope],
    ["กลุ่มเป้าหมาย", data.targetGroup],
    ["ผู้รับผิดชอบ", data.responsible],
  ] as const;

  const leftX = 0.3, leftW = 6.4, blockH = 0.95;
  let y = 1.55;
  for (const [label, val] of leftItems) {
    slide.addShape("rect", { x: leftX, y, w: 0.08, h: blockH, fill: { color: accent }, line: { color: accent } });
    slide.addText(label, { x: leftX + 0.18, y, w: leftW - 0.2, h: 0.28, fontFace: "Sarabun", fontSize: 11, bold: true, color: "64748B" });
    slide.addText(val || "—", { x: leftX + 0.18, y: y + 0.28, w: leftW - 0.2, h: blockH - 0.28, fontFace: "Sarabun", fontSize: 12, color: "0F172A", valign: "top" });
    y += blockH + 0.08;
  }

  const rightX = 7.0, rightW = 6.0;
  let ry = 1.55;
  if (data.imageUrl) {
    const img = await loadImage(data.imageUrl);
    if (img) {
      slide.addImage({ data: img.dataUrl, x: rightX, y: ry, w: rightW, h: 1.6 });
      ry += 1.7;
    }
  }

  slide.addShape("roundRect", { x: rightX, y: ry, w: rightW / 2 - 0.05, h: 0.7, fill: { color: "F8FAFC" }, line: { color: "E2E8F0" }, rectRadius: 0.06 });
  slide.addText("งบประมาณ", { x: rightX + 0.1, y: ry + 0.05, w: rightW / 2 - 0.2, h: 0.25, fontFace: "Sarabun", fontSize: 10, bold: true, color: "64748B" });
  slide.addText(data.budget || "—", { x: rightX + 0.1, y: ry + 0.28, w: rightW / 2 - 0.2, h: 0.4, fontFace: "Sarabun", fontSize: 14, bold: true, color: accent });

  slide.addShape("roundRect", { x: rightX + rightW / 2 + 0.05, y: ry, w: rightW / 2 - 0.05, h: 0.7, fill: { color: "F8FAFC" }, line: { color: "E2E8F0" }, rectRadius: 0.06 });
  slide.addText("ระยะเวลา", { x: rightX + rightW / 2 + 0.15, y: ry + 0.05, w: rightW / 2 - 0.2, h: 0.25, fontFace: "Sarabun", fontSize: 10, bold: true, color: "64748B" });
  slide.addText(data.timeline || "—", { x: rightX + rightW / 2 + 0.15, y: ry + 0.28, w: rightW / 2 - 0.2, h: 0.4, fontFace: "Sarabun", fontSize: 14, bold: true, color: accent });
  ry += 0.85;

  if (data.kpis.length > 0) {
    slide.addText(
      [
        { text: "ตัวชี้วัด (KPI)\n", options: { bold: true, fontSize: 11, color: "0F172A" } },
        ...data.kpis.flatMap((k) => [
          { text: `• ${k.name}`, options: { fontSize: 11, color: "0F172A" } },
          { text: ` · ${k.target}\n`, options: { fontSize: 11, color: "64748B" } },
        ]),
      ] as any,
      { x: rightX, y: ry, w: rightW, h: 1.0, fontFace: "Sarabun", valign: "top", fill: { color: "F8FAFC" }, line: { color: "E2E8F0" }, margin: 6 }
    );
    ry += 1.05;
  }

  if (data.activities.length > 0) {
    slide.addText(
      [
        { text: "กิจกรรม / ขั้นตอน\n", options: { bold: true, fontSize: 11, color: "0F172A" } },
        ...data.activities.flatMap((a) => [
          { text: `• ${a.name}`, options: { fontSize: 11, color: "0F172A" } },
          { text: ` · ${a.period} · ${a.status}\n`, options: { fontSize: 11, color: "64748B" } },
        ]),
      ] as any,
      { x: rightX, y: ry, w: rightW, h: 1.2, fontFace: "Sarabun", valign: "top", fill: { color: "F8FAFC" }, line: { color: "E2E8F0" }, margin: 6 }
    );
  }

  slide.addShape("rect", { x: 0, y: 6.95, w: 13.333, h: 0.55, fill: { color: "F8FAFC" }, line: { color: "E2E8F0" } });
  slide.addText("ผลที่คาดว่าจะได้รับ:  ", { x: 0.3, y: 7.0, w: 12.7, h: 0.45, fontFace: "Sarabun", fontSize: 11, bold: true, color: accent });
  slide.addText(data.outcome || "—", { x: 2.0, y: 7.0, w: 11.0, h: 0.45, fontFace: "Sarabun", fontSize: 11, color: "0F172A", valign: "middle" });

  const out = await pptx.write({ outputType: "nodebuffer" });
  return toBuffer(out);
}

// ====================================================================
//  REPORT — รายงานกิจกรรม (portrait)
// ====================================================================
/**
 * Activity Report (A4 portrait 8.27" × 11.69")
 * Outlined design — header/footer มี border 2px (ไม่ใช่ filled bg)
 * + decorative frame inset 8px + corner ticks
 * + photo grid 2 cols × 3 rows (4:3 cells)
 * + slogan สีน้ำเงินเข้ม กลาง footer ระหว่าง brand icons + QR
 */
async function exportReportPptx(_title: string, data: OnePageReportData): Promise<Buffer> {
  const pptx = new PPTXGen();
  // A4 portrait
  pptx.defineLayout({ name: "A4P", width: 8.27, height: 11.69 });
  pptx.layout = "A4P";
  pptx.defineSlideMaster({ title: "M", background: { color: "FFFFFF" } });

  const slide = pptx.addSlide();

  const primary = (data.primaryColor || data.headerColor || "#1e3a7a").replace("#", "");
  const primaryDark = darkenHex(primary, 0.25);
  const dateColor = (data.dateColor || "#" + primary).replace("#", "");

  // ===== HEADER (outlined, rounded) =====
  const HX = 0.25, HY = 0.25, HW = 7.77, HH = 1.4;
  drawRoundRect(slide, HX, HY, HW, HH, primary, { fill: "FFFFFF", thickness: 2, radius: 0.15 });

  // header text (center) — fontSize / bold mirror the preview's per-field
  // overrides so the PPTX export matches what the user designed on screen.
  slide.addText(data.agencyName || "ชื่อหน่วยงาน", {
    x: HX + 1.2, y: HY + 0.15, w: HW - 2.4, h: 0.4,
    fontFace: "Sarabun",
    fontSize: data.agencyNameFontSize ?? 18,
    bold: data.agencyNameBold ?? true,
    color: primaryDark,
    align: "center", valign: "middle",
  });
  slide.addText(data.subAgency || "", {
    x: HX + 1.2, y: HY + 0.55, w: HW - 2.4, h: 0.3,
    fontFace: "Sarabun",
    fontSize: data.subAgencyFontSize ?? 13,
    bold: data.subAgencyBold ?? false,
    color: primaryDark,
    align: "center", valign: "middle",
  });
  if (data.dateLine) {
    slide.addText(data.dateLine, {
      x: HX + 1.4, y: HY + 0.95, w: HW - 2.8, h: 0.32,
      fontFace: "Sarabun", fontSize: 13, bold: true, color: dateColor,
      align: "center", valign: "middle",
      line: { color: dateColor, width: 0.5, dashType: "solid" },
    });
  }

  // header logos — ไม่มีกรอบวงกลม/dashed ring ใส่รูปลอย ๆ
  const LOGO_D = 1.0;
  const LOGO_Y = HY + (HH - LOGO_D) / 2;
  if (data.leftLogoUrl) {
    const img = await loadImage(data.leftLogoUrl);
    if (img) slide.addImage({
      data: img.dataUrl,
      x: HX + 0.12, y: LOGO_Y, w: LOGO_D, h: LOGO_D,
      sizing: { type: "contain", w: LOGO_D, h: LOGO_D },
    });
  } else {
    slide.addText("LOGO\nLEFT", {
      x: HX + 0.12, y: LOGO_Y, w: LOGO_D, h: LOGO_D,
      fontFace: "Courier New", fontSize: 7, color: primaryDark,
      align: "center", valign: "middle",
    });
  }
  if (data.rightLogoUrl) {
    const img = await loadImage(data.rightLogoUrl);
    if (img) slide.addImage({
      data: img.dataUrl,
      x: HX + HW - LOGO_D - 0.12, y: LOGO_Y, w: LOGO_D, h: LOGO_D,
      sizing: { type: "contain", w: LOGO_D, h: LOGO_D },
    });
  } else {
    slide.addText("LOGO\nRIGHT", {
      x: HX + HW - LOGO_D - 0.12, y: LOGO_Y, w: LOGO_D, h: LOGO_D,
      fontFace: "Courier New", fontSize: 7, color: primaryDark,
      align: "center", valign: "middle",
    });
  }

  // ===== PHOTO GRID 2×3 (4:3) =====
  const GX = 0.25, GY = HY + HH + 0.2;
  const GW = 7.77, GAP = 0.1;
  const CW = (GW - GAP) / 2;
  const CH = CW * 3 / 4;        // 4:3
  const GH = CH * 3 + GAP * 2;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const i = r * 2 + c;
      const x = GX + c * (CW + GAP);
      const y = GY + r * (CH + GAP);
      const url = data.images[i];
      if (url) {
        const img = await loadImage(url);
        if (img) {
          slide.addImage({ data: img.dataUrl, x, y, w: CW, h: CH, sizing: { type: "cover", w: CW, h: CH } });
          continue;
        }
      }
      // placeholder
      drawRect(slide, x, y, CW, CH, "CFD6E0", { fill: "EEF1F6", thickness: 0.5 });
    }
  }

  // ===== CAPTION =====
  const CAP_Y = GY + GH + 0.15;
  const CAP_H = 11.69 - 0.25 - 1.1 - CAP_Y;   // ที่เหลือก่อน footer
  // Sanitize first — Tiptap HTML is user-controlled. The text-runs walker
  // only recognises a closed set of tags so malicious attributes can't
  // sneak through, but we sanitize anyway to keep one trusted entry point.
  const safeHtml = sanitizeRichHtml(data.paragraphHtml || `<p>${escapePlain(data.paragraph || "")}</p>`);
  const textRuns = htmlToTextRuns(safeHtml);
  // Falling back to a single empty run when the editor was empty avoids
  // pptxgenjs throwing on a zero-length array.
  const captionRuns = textRuns.length > 0 ? textRuns : [{ text: "" }];
  slide.addText(captionRuns, {
    x: 0.4, y: CAP_Y, w: 7.47, h: CAP_H,
    fontFace: "Sarabun", fontSize: 12, color: "111418",
    valign: "top", paraSpaceAfter: 4, indentLevel: 0,
    // Frame-level align is the FALLBACK when an individual run doesn't
    // specify its own. Block-level `text-align: center/right/justify`
    // from the editor lands on per-run `align`, overriding this.
    align: "justify",
  });

  // ===== FOOTER (outlined, rounded) =====
  const FX = 0.25, FY = 11.69 - 1.1, FW = 7.77, FH_ = 0.85;
  drawRoundRect(slide, FX, FY, FW, FH_, primary, { fill: "FFFFFF", thickness: 2, radius: 0.15 });

  // slogan กลาง
  const sloganText = (data.slogan || "เทิดราชัน·ทันสมัย·พัฒนา")
    .split(/[·•\/,]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .join("  •  ");
  slide.addText(sloganText, {
    x: FX + 1.4, y: FY + 0.1, w: FW - 2.8, h: FH_ - 0.2,
    fontFace: "Sarabun",
    fontSize: data.sloganFontSize ?? 18,
    bold: data.sloganBold ?? true,
    color: primaryDark, align: "center", valign: "middle",
    charSpacing: 1,
  });

  // ซ้าย: chrome icon + QR
  drawCircle(slide, FX + 0.1, FY + 0.18, 0.5, "1A73E8", "1A73E8", 0);  // chrome (simple blue)
  slide.addText("C", {
    x: FX + 0.1, y: FY + 0.18, w: 0.5, h: 0.5,
    fontFace: "Arial", fontSize: 18, bold: true, color: "FFFFFF",
    align: "center", valign: "middle",
  });
  if (data.websiteQrUrl || data.qrUrl) {
    const img = await loadImage(data.websiteQrUrl || data.qrUrl || "");
    if (img) slide.addImage({ data: img.dataUrl, x: FX + 0.7, y: FY + 0.15, w: 0.55, h: 0.55 });
  } else {
    drawRect(slide, FX + 0.7, FY + 0.15, 0.55, 0.55, "D1D5DB", { fill: "FFFFFF", thickness: 0.5 });
  }

  // ขวา: QR + facebook icon
  if (data.facebookQrUrl) {
    const img = await loadImage(data.facebookQrUrl);
    if (img) slide.addImage({ data: img.dataUrl, x: FX + FW - 1.25, y: FY + 0.15, w: 0.55, h: 0.55 });
  } else {
    drawRect(slide, FX + FW - 1.25, FY + 0.15, 0.55, 0.55, "D1D5DB", { fill: "FFFFFF", thickness: 0.5 });
  }
  drawCircle(slide, FX + FW - 0.6, FY + 0.18, 0.5, "1877F2", "1877F2", 0);
  slide.addText("f", {
    x: FX + FW - 0.6, y: FY + 0.18, w: 0.5, h: 0.5,
    fontFace: "Arial", fontSize: 22, bold: true, italic: true, color: "FFFFFF",
    align: "center", valign: "middle",
  });

  const out = await pptx.write({ outputType: "nodebuffer" });
  return toBuffer(out);
}

// ====== pptx draw helpers ======
function drawRect(slide: any, x: number, y: number, w: number, h: number, line: string, opts: { fill?: string; thickness?: number } = {}) {
  slide.addShape("rect", {
    x, y, w, h,
    fill: opts.fill ? { color: opts.fill } : { type: "none" } as any,
    line: { color: line, width: opts.thickness ?? 1 },
  });
}
function drawRoundRect(slide: any, x: number, y: number, w: number, h: number, line: string, opts: { fill?: string; thickness?: number; radius?: number } = {}) {
  slide.addShape("roundRect", {
    x, y, w, h,
    rectRadius: opts.radius ?? 0.08,
    fill: opts.fill ? { color: opts.fill } : { type: "none" } as any,
    line: { color: line, width: opts.thickness ?? 1 },
  });
}
function drawLine(slide: any, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  slide.addShape("line", {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1) || 0.01, h: Math.abs(y2 - y1) || 0.01,
    line: { color, width },
    flipV: y2 < y1,
    flipH: x2 < x1,
  });
}
function drawCircle(slide: any, x: number, y: number, d: number, fill: string, lineColor: string, lineW: number) {
  slide.addShape("ellipse", {
    x, y, w: d, h: d,
    fill: { color: fill },
    line: { color: lineColor, width: lineW },
  });
}

function darkenHex(hex: string, amount: number): string {
  const m = /^([0-9a-f]{6})$/i.exec(hex.replace("#", ""));
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

// แปลง HTML (Tiptap output) → plain text เก็บ paragraph break
function htmlToText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapePlain(s: string) {
  return s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ============ helpers ============
type Slot = { x: number; y: number; w: number; h: number };

function computeGridSlots(n: number, x: number, y: number, w: number, h: number): Slot[] {
  const gap = 0.08;
  switch (n) {
    case 0: return [];
    case 1: return [{ x, y, w, h }];
    case 2: {
      const cw = (w - gap) / 2;
      return [
        { x, y, w: cw, h },
        { x: x + cw + gap, y, w: cw, h },
      ];
    }
    case 3: {
      const cw = (w - gap) / 2;
      const rh = (h - gap) / 2;
      return [
        { x, y, w: cw, h }, // tall left
        { x: x + cw + gap, y, w: cw, h: rh },
        { x: x + cw + gap, y: y + rh + gap, w: cw, h: rh },
      ];
    }
    case 4: {
      const cw = (w - gap) / 2;
      const rh = (h - gap) / 2;
      return [
        { x, y, w: cw, h: rh },
        { x: x + cw + gap, y, w: cw, h: rh },
        { x, y: y + rh + gap, w: cw, h: rh },
        { x: x + cw + gap, y: y + rh + gap, w: cw, h: rh },
      ];
    }
    case 5: {
      const cw = (w - gap * 2) / 3;
      const rh = (h - gap) / 2;
      return [
        { x, y, w: cw, h }, // tall left
        { x: x + cw + gap, y, w: cw, h: rh },
        { x: x + cw * 2 + gap * 2, y, w: cw, h: rh },
        { x: x + cw + gap, y: y + rh + gap, w: cw, h: rh },
        { x: x + cw * 2 + gap * 2, y: y + rh + gap, w: cw, h: rh },
      ];
    }
    case 6:
    default: {
      const cw = (w - gap * 2) / 3;
      const rh = (h - gap) / 2;
      const slots: Slot[] = [];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          slots.push({
            x: x + c * (cw + gap),
            y: y + r * (rh + gap),
            w: cw,
            h: rh,
          });
        }
      }
      return slots;
    }
  }
}

// Confine file reads strictly to a handful of public sub-trees. Without
// this, an attacker who can write `imageUrl` (any logged-in user) could read
// arbitrary files from the server with `/uploads/../../.env`-style payloads.
//
// `/uploads/`  — user-uploaded images (validated by /api/upload)
// `/defaults/` — bundled assets we ship with the app (default logos, etc.)
const ALLOWED_PREFIXES = ["/uploads/", "/defaults/"] as const;
const ALLOWED_ROOTS = ALLOWED_PREFIXES.map((p) =>
  path.resolve(process.cwd(), "public", p.replace(/^\//, "").replace(/\/$/, "")),
);

async function loadImage(url: string): Promise<{ dataUrl: string } | null> {
  try {
    if (ALLOWED_PREFIXES.some((p) => url.startsWith(p))) {
      const requested = path.resolve(
        process.cwd(),
        "public",
        url.replace(/^\//, ""),
      );
      // `path.resolve` normalizes `..`; require the result to live inside one
      // of the whitelisted roots. Trailing-separator check stops the
      // `/uploads-evil/` directory-name confusion bug.
      const inAllowedRoot = ALLOWED_ROOTS.some(
        (root) => requested === root || requested.startsWith(root + path.sep),
      );
      if (!inAllowedRoot) return null;

      const buf = await readFile(requested);
      const ext = path.extname(requested).slice(1).toLowerCase();
      // SVG intentionally omitted — see api/upload/route.ts; an old SVG
      // upload predating the lockdown should not be re-emitted as image/svg+xml.
      const mime =
        ext === "png" ? "image/png" :
        ext === "webp" ? "image/webp" : "image/jpeg";
      return { dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
    }
    if (url.startsWith("data:")) return { dataUrl: url };
    return null;
  } catch {
    return null;
  }
}

function lighten(hex: string, amount = 0.15) {
  const num = parseInt(hex, 16);
  let r = (num >> 16) + Math.round(255 * amount);
  let g = ((num >> 8) & 0xff) + Math.round(255 * amount);
  let b = (num & 0xff) + Math.round(255 * amount);
  r = Math.min(255, r);
  g = Math.min(255, g);
  b = Math.min(255, b);
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

/**
 * pptxgenjs `write()` returns `Buffer | ArrayBuffer | Uint8Array | Blob`
 * depending on the runtime. Normalise to `Buffer` so route handlers can
 * stream it back without TypeScript fighting the overload table.
 */
function toBuffer(out: unknown): Buffer {
  if (Buffer.isBuffer(out)) return out;
  if (out instanceof Uint8Array) return Buffer.from(out);
  if (out instanceof ArrayBuffer) return Buffer.from(new Uint8Array(out));
  // Fallback — strings (base64) shouldn't happen for nodebuffer mode but
  // handle defensively so we never throw an unhelpful overload error.
  if (typeof out === "string") return Buffer.from(out, "base64");
  throw new Error("export-pptx: unexpected output type from pptxgenjs.write()");
}
