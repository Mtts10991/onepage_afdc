"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  src: string | null;
  /** ค่า aspect เริ่มต้น — undefined = free crop */
  aspect?: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCropped: (blob: Blob) => void;
}

export function ImageCropDialog({ src, aspect, open, onOpenChange, onCropped }: Props) {
  const t = useTranslations("image");
  const tc = useTranslations("common");
  const ASPECTS: { label: string; value: number | undefined }[] = [
    { label: t("aspectFree"), value: undefined },
    { label: "1:1", value: 1 },
    { label: "4:3", value: 4 / 3 },
    { label: "16:9", value: 16 / 9 },
    { label: "3:4", value: 3 / 4 },
  ];
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [currentAspect, setCurrentAspect] = useState<number | undefined>(aspect);

  useEffect(() => {
    if (open) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCurrentAspect(aspect);
    }
  }, [open, aspect]);

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setCroppedArea(area);
  }, []);

  async function apply() {
    if (!src || !croppedArea) return;
    const blob = await getCroppedBlob(src, croppedArea, rotation);
    onCropped(blob);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("crop")}</DialogTitle>
          <DialogDescription>{t("cropDescription")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1">
          <Label className="text-xs mr-2">{t("aspectRatio")}</Label>
          {ASPECTS.map((a) => (
            <Button
              key={a.label}
              type="button"
              size="sm"
              variant={currentAspect === a.value ? "default" : "outline"}
              onClick={() => setCurrentAspect(a.value)}
              className="h-7 text-xs"
            >
              {a.label}
            </Button>
          ))}
        </div>

        <div className="relative w-full h-[360px] bg-black rounded-md overflow-hidden">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={currentAspect}
              objectFit="contain"
              restrictPosition={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="crop-zoom" className="text-xs">
              {t("zoom")} ({zoom.toFixed(2)}x)
            </Label>
            <input
              id="crop-zoom"
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
              aria-label={t("zoom")}
              aria-valuemin={0.5}
              aria-valuemax={3}
              aria-valuenow={zoom}
              aria-valuetext={`${zoom.toFixed(2)}x`}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="crop-rotate" className="text-xs">
              {t("rotate")} ({rotation}°)
            </Label>
            <input
              id="crop-rotate"
              type="range"
              min={0}
              max={360}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full"
              aria-label={t("rotate")}
              aria-valuemin={0}
              aria-valuemax={360}
              aria-valuenow={rotation}
              aria-valuetext={`${rotation} degrees`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={apply}>{t("apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// crop → blob (รองรับ negative coords จาก restrictPosition=false)
async function getCroppedBlob(
  src: string,
  area: Area,
  rotation: number
): Promise<Blob> {
  const image = await loadImage(src);
  const radians = (rotation * Math.PI) / 180;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const safeSize = Math.max(image.width, image.height) * 2;
  canvas.width = safeSize;
  canvas.height = safeSize;

  // วาดรูปกลาง canvas พร้อม rotate
  ctx.translate(safeSize / 2, safeSize / 2);
  ctx.rotate(radians);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  // คำนวณตำแหน่งใน safe canvas (กลางคือ image กลาง)
  const offsetX = Math.round(safeSize / 2 - image.width / 2 + area.x);
  const offsetY = Math.round(safeSize / 2 - image.height / 2 + area.y);
  const w = Math.max(1, Math.round(area.width));
  const h = Math.max(1, Math.round(area.height));

  // ใช้ canvas อีกตัวเพื่อ crop (รองรับ source อยู่นอก canvas)
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const outCtx = out.getContext("2d")!;

  // เติมพื้นโปร่งใส
  outCtx.clearRect(0, 0, w, h);
  outCtx.drawImage(canvas, offsetX, offsetY, w, h, 0, 0, w, h);

  return new Promise<Blob>((resolve) => {
    out.toBlob((b) => resolve(b!), "image/png", 0.95);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
