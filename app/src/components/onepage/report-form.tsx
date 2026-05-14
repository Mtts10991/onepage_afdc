"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Plus, Trash2, Calendar, Info } from "lucide-react";
import { ImagePicker } from "./image-picker";
import { TextStyleControls } from "./text-style-controls";
import { formatThaiDateLine, todayIso } from "@/lib/thai-date";
import type { OnePageReportData } from "@/lib/onepage-schema";

interface Props {
  value: OnePageReportData;
  onChange: (v: OnePageReportData) => void;
}

export function ReportForm({ value, onChange }: Props) {
  const t = useTranslations("report.form");
  const set = <K extends keyof OnePageReportData>(k: K, v: OnePageReportData[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <CollapsibleCard id="report-header" title={t("header")}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("leftLogo")}</Label>
            <ImagePicker value={value.leftLogoUrl} onChange={(u) => set("leftLogoUrl", u)} />
            <p className="text-xs text-muted-foreground">{t("logoFreeNote")}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t("rightLogo")}</Label>
            <ImagePicker value={value.rightLogoUrl} onChange={(u) => set("rightLogoUrl", u)} />
          </div>
        </div>
        <LogoSpecHint />
        <div className="space-y-1.5">
          <Label>{t("agencyNameLabel")}</Label>
          <Input
            value={value.agencyName}
            onChange={(e) => set("agencyName", e.target.value)}
            placeholder={t("agencyNamePlaceholder")}
          />
          <TextStyleControls
            idPrefix="agency-name"
            fontSize={value.agencyNameFontSize}
            bold={value.agencyNameBold}
            onFontSizeChange={(s) => set("agencyNameFontSize", s)}
            onBoldChange={(b) => set("agencyNameBold", b)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t("subAgencyLabel")}</Label>
          <Input
            value={value.subAgency}
            onChange={(e) => set("subAgency", e.target.value)}
            placeholder={t("subAgencyPlaceholder")}
          />
          <TextStyleControls
            idPrefix="sub-agency"
            fontSize={value.subAgencyFontSize}
            bold={value.subAgencyBold}
            onFontSizeChange={(s) => set("subAgencyFontSize", s)}
            onBoldChange={(b) => set("subAgencyBold", b)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> {t("dateLabel")}
          </Label>
          <div className="grid sm:grid-cols-[180px_120px_1fr] gap-2">
            <Input
              type="date"
              value={value.dateIso || ""}
              onChange={(e) => {
                const iso = e.target.value;
                onChange({
                  ...value,
                  dateIso: iso,
                  dateLine: formatThaiDateLine(iso),
                });
              }}
            />
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={value.dateColor || "#1e3a7a"}
                onChange={(e) => set("dateColor", e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
                title={t("dateColorTitle")}
              />
              <span className="text-xs text-muted-foreground">{t("colorLabel")}</span>
            </div>
            <Input
              value={value.dateLine}
              onChange={(e) => set("dateLine", e.target.value)}
              placeholder={t("dateLinePlaceholder")}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                const iso = todayIso();
                onChange({
                  ...value,
                  dateIso: iso,
                  dateLine: formatThaiDateLine(iso),
                });
              }}
            >
              {t("useToday")}
            </Button>
            {value.dateIso && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => set("dateLine", formatThaiDateLine(value.dateIso))}
              >
                {t("generateNew")}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {t("dateHelpText")}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t("primaryColorLabel")}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={value.primaryColor || "#1e3a7a"}
              onChange={(e) => {
                const c = e.target.value;
                onChange({
                  ...value,
                  primaryColor: c,
                  headerColor: c,
                  footerColor: c,
                });
              }}
              className="w-16 h-9 p-1"
            />
            <Input
              type="text"
              value={value.primaryColor || "#1e3a7a"}
              onChange={(e) => set("primaryColor", e.target.value)}
              placeholder="#1e3a7a"
              className="font-mono text-xs"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t("primaryColorNote")}
          </p>
        </div>
      </CollapsibleCard>

      {/* IMAGES */}
      <CollapsibleCard
        id="report-images"
        title={t("imagesTitle", { count: value.images.length, max: 6 })}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={value.images.length >= 6}
            onClick={() => set("images", [...value.images, ""])}
          >
            <Plus className="h-4 w-4" /> {t("addImage")}
          </Button>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {value.images.map((src, i) => (
            <div key={i} className="space-y-1 min-w-0">
              <div className="relative">
                <ImagePicker
                  value={src || null}
                  aspect={4 / 3}
                  onChange={(url) => {
                    const arr = [...value.images];
                    arr[i] = url ?? "";
                    set("images", arr);
                  }}
                />
                <button
                  type="button"
                  onClick={() => set("images", value.images.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 z-10 grid place-items-center w-7 h-7 rounded-full bg-destructive/90 text-white shadow-md cursor-pointer transition-all duration-150 ease-out hover:bg-destructive hover:scale-110 hover:shadow-lg hover:shadow-destructive/30 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
                  title={t("delete")}
                  aria-label={t("deleteImage")}
                >
                  <Trash2 className="h-3.5 w-3.5 transition-transform duration-150" />
                </button>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                #{String(i + 1).padStart(2, "0")}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* PARAGRAPH */}
      <CollapsibleCard id="report-paragraph" title={t("contentTitle")}>
        <div className="space-y-1.5">
          <RichTextEditor
            value={value.paragraphHtml || (value.paragraph ? `<p>${escapeHtml(value.paragraph)}</p>` : "")}
            onChange={(html) => {
              onChange({ ...value, paragraphHtml: html, paragraph: stripHtml(html) });
            }}
            placeholder={t("contentPlaceholder")}
            minHeight={220}
            contentWidth={758}
            fontSize={14}
            lineHeight={1.55}
            textAlign="justify"
          />
        </div>
      </CollapsibleCard>

      {/* FOOTER */}
      <CollapsibleCard id="report-footer" title={t("footerTitle")}>
        <div className="space-y-1.5">
          <Label>{t("sloganLabel")}</Label>
          <Input
            value={value.slogan}
            onChange={(e) => set("slogan", e.target.value)}
            placeholder={t("sloganPlaceholder")}
          />
          <TextStyleControls
            idPrefix="slogan"
            fontSize={value.sloganFontSize}
            bold={value.sloganBold}
            onFontSizeChange={(s) => set("sloganFontSize", s)}
            onBoldChange={(b) => set("sloganBold", b)}
          />
          <p className="text-xs text-muted-foreground">
            {t("sloganNote")}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs">{t("websiteQrLabel")}</Label>
            <ImagePicker value={value.websiteQrUrl} aspect={1} onChange={(u) => set("websiteQrUrl", u)} />
            <Input
              value={value.websiteLabel}
              onChange={(e) => set("websiteLabel", e.target.value)}
              placeholder={t("websiteLabelPlaceholder")}
            />
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <Label className="text-xs">{t("facebookQrLabel")}</Label>
            <ImagePicker value={value.facebookQrUrl} aspect={1} onChange={(u) => set("facebookQrUrl", u)} />
            <Input
              value={value.facebookLabel}
              onChange={(e) => set("facebookLabel", e.target.value)}
              placeholder={t("facebookLabelPlaceholder")}
            />
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

function stripHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent ?? tmp.innerText ?? "").trim();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Static hint block that explains the recommended logo file specs.
 *
 * Numbers come from the PPTX export geometry (1×1 inch frame, see
 * `LOGO_D` in lib/export-pptx.ts): a 300 DPI source is the lowest quality
 * that still prints crisply at that size, hence 300×300 px minimum and
 * 400×400 px+ for safety. Aspect ratio is intentionally permissive — the
 * preview locks logo height and lets width float so non-square crops
 * still align (see report-preview.module.scss `.headerLogo`).
 */
function LogoSpecHint() {
  const t = useTranslations("report.form");
  return (
    <div
      role="note"
      aria-labelledby="logo-spec-title"
      className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
    >
      <div
        id="logo-spec-title"
        className="flex items-center gap-1.5 font-medium text-foreground"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        {t("logoSpecTitle")}
      </div>
      <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
        <li>{t("logoSpecPrimary")}</li>
        <li>{t("logoSpecRecommended")}</li>
        <li>{t("logoSpecFormat")}</li>
        <li>{t("logoSpecAspect")}</li>
      </ul>
    </div>
  );
}
