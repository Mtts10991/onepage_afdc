"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Maximize2, Minimize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Width จริงของ canvas (เช่น 794 สำหรับ A4 portrait) */
  width: number;
  /** Height จริงของ canvas (เช่น 1123 สำหรับ A4 portrait) */
  height: number;
  /** เปอร์เซ็นต์ scale เริ่มต้น (0-100). ค่าปริยาย 50 */
  defaultScale?: number;
  children: React.ReactNode;
}

/**
 * Preview container —
 * - ปรับ scale ผ่าน slider / ปุ่ม +/- (ค่าปริยาย 50%)
 * - ปุ่ม Reset → กลับ default
 * - ปุ่ม Fullscreen → ดู 100%
 */
export function PreviewFrame({
  width,
  height,
  defaultScale = 50,
  children,
}: Props) {
  const t = useTranslations("preview");
  const tc = useTranslations("common");
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scalePct, setScalePct] = useState(defaultScale);
  const [containerW, setContainerW] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // เก็บ scale ก่อนเข้า fullscreen เพื่อย้อนคืนเมื่อออก
  const prevScaleRef = useRef<number>(defaultScale);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => setContainerW(wrap.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Body scroll lock + ESC to exit เมื่ออยู่ใน fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  function toggleFullscreen() {
    setFullscreen((f) => {
      if (!f) {
        // เข้า fullscreen → จำ scale ปัจจุบัน + auto-fit ให้พอดีหน้าจอ
        prevScaleRef.current = scalePct;
        if (typeof window !== "undefined") {
          const padding = 80; // เผื่อ toolbar + padding
          const fitW = ((window.innerWidth - padding) / width) * 100;
          const fitH = ((window.innerHeight - padding) / height) * 100;
          const fit = Math.max(20, Math.min(150, Math.floor(Math.min(fitW, fitH))));
          setScalePct(fit);
        }
        return true;
      }
      // ออก fullscreen → คืน scale เดิม
      setScalePct(prevScaleRef.current);
      return false;
    });
  }

  const scale = scalePct / 100;

  return (
    <div
      className={cn(
        fullscreen
          ? "fixed inset-0 z-[100] bg-background overflow-auto p-4 flex flex-col"
          : "relative",
      )}
    >
      {/* Floating close button — เห็นชัด คลิกง่าย ใน fullscreen */}
      {fullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={tc("close")}
          title={`${tc("close")} (Esc)`}
          className="fixed top-4 right-4 z-[110] grid place-items-center w-10 h-10 rounded-full bg-destructive text-destructive-foreground shadow-lg cursor-pointer transition-all duration-150 ease-out hover:bg-destructive hover:scale-110 hover:shadow-xl hover:shadow-destructive/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div
        className={cn(
          "flex flex-wrap items-center gap-2 mb-2 text-xs",
          fullscreen && "sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 px-1 -mx-1 border-b shrink-0",
        )}
      >
        <span className="text-muted-foreground tabular-nums">
          {Math.round(scalePct)}% · {width}×{height}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => setScalePct((s) => Math.max(20, s - 10))}
            className="h-7 w-7"
            title={t("zoomOut")}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <input
            type="range"
            min={20}
            max={150}
            step={5}
            value={scalePct}
            onChange={(e) => setScalePct(Number(e.target.value))}
            className="w-24 cursor-pointer accent-primary"
            title={t("scale")}
            aria-label={t("scale")}
            aria-valuemin={20}
            aria-valuemax={150}
            aria-valuenow={scalePct}
            aria-valuetext={`${scalePct}%`}
          />

          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => setScalePct((s) => Math.min(150, s + 10))}
            className="h-7 w-7"
            title={t("zoomIn")}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            type="button"
            onClick={() => setScalePct(defaultScale)}
            className="h-7 w-7"
            title={t("reset", { scale: defaultScale })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <Button
            size="sm"
            variant={fullscreen ? "default" : "ghost"}
            type="button"
            onClick={toggleFullscreen}
            className="h-7 px-2"
            aria-pressed={fullscreen}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" /> {t("exitFullscreen")}
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" /> {t("enterFullscreen")}
              </>
            )}
          </Button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className={cn(
          "w-full flex justify-center",
          fullscreen && "flex-1 items-start overflow-auto",
        )}
      >
        {/* canvas เพียวๆ ไม่มีกรอบ wrap */}
        <div
          style={{
            width: width * scale,
            height: height * scale,
            maxWidth: fullscreen ? "none" : "100%",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width,
              height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
