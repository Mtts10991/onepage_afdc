"use client";

import { useTranslations } from "next-intl";
import { Bold, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  /** Current font size in pt. */
  fontSize: number;
  /** Whether the text is currently bold. */
  bold: boolean;
  /** Callbacks — kept as two so callers can wire them straight into setState. */
  onFontSizeChange: (size: number) => void;
  onBoldChange: (bold: boolean) => void;
  /**
   * Allowed pt range. Schema caps at 8–48 so the layout can't be broken; UI
   * mirrors that. Step is 1 pt — slider feels jittery at 0.5 and most users
   * won't notice the difference.
   */
  min?: number;
  max?: number;
  /** ID prefix so multiple instances on a page don't collide with each other. */
  idPrefix: string;
}

/**
 * Compact font-size + bold toggle row for report header/footer fields.
 * Kept controlled (no internal state) so it round-trips cleanly through the
 * parent form's onChange tree.
 */
export function TextStyleControls({
  fontSize,
  bold,
  onFontSizeChange,
  onBoldChange,
  min = 8,
  max = 48,
  idPrefix,
}: Props) {
  const t = useTranslations("textStyle");

  // Clamp on the way in too — historical onepages may carry out-of-range
  // values before the schema clamp shipped.
  const clamped = Math.max(min, Math.min(max, fontSize));

  return (
    <div className="flex items-center gap-2 text-xs">
      <Type className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <label htmlFor={`${idPrefix}-fontsize`} className="sr-only">
        {t("fontSize")}
      </label>
      <input
        id={`${idPrefix}-fontsize`}
        type="range"
        min={min}
        max={max}
        step={1}
        value={clamped}
        onChange={(e) => onFontSizeChange(Number(e.target.value))}
        className="w-24 cursor-pointer accent-primary"
        aria-label={t("fontSize")}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={`${clamped}pt`}
      />
      <span className="tabular-nums text-muted-foreground w-10">
        {clamped}pt
      </span>

      <button
        type="button"
        onClick={() => onBoldChange(!bold)}
        aria-label={t("bold")}
        aria-pressed={bold}
        title={t("bold")}
        className={cn(
          "grid place-items-center h-7 w-7 rounded-md border transition-all duration-150 ease-out cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "hover:bg-accent hover:text-accent-foreground active:scale-95",
          bold
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-background text-foreground border-input",
        )}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
