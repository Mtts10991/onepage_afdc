"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImagePlus, Crop, X } from "lucide-react";
import { ImageCropDialog } from "./image-crop-dialog";

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  aspect?: number;
}

/**
 * ImagePicker
 *  - aspect: undefined → crop dialog เปิดด้วย "อิสระ" (ผู้ใช้กำหนดเอง)
 *  - aspect: number    → crop dialog เริ่มต้นที่ ratio นั้น (แต่ผู้ใช้เปลี่ยนได้)
 *  - preview frame ใช้ object-contain → ไม่ตัดรูปหลังอัปโหลด
 */
export function ImagePicker({ value, onChange, aspect }: Props) {
  const t = useTranslations("image");
  const tu = useTranslations("upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  function mapUploadError(
    code: string | undefined,
    maxMb: number,
    maxDim: number,
  ): string {
    const map: Record<string, string> = {
      too_large: tu("tooLarge", { max: maxMb }),
      type_not_allowed: tu("typeNotAllowed"),
      dimensions_too_large: tu("dimensionsTooLarge", { max: maxDim }),
      invalid_image: tu("invalidImage"),
      empty_file: tu("emptyFile"),
    };
    return map[code ?? ""] ?? tu("failed");
  }

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    try {
      const contentType = blob.type || "image/png";

      // Step 1 — ask the server for a signed upload URL. This request is
      // tiny JSON, so it never trips Vercel's 4.5 MB function-payload cap.
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType, size: blob.size }),
      });

      if (signRes.ok) {
        const { signedUrl, publicUrl } = await signRes.json();
        // Step 2 — PUT the bytes STRAIGHT to Supabase Storage. The file
        // never passes through a Vercel function, so there is no 4.5 MB
        // limit on it — only the bucket's own (much larger) limit.
        const putRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });
        if (!putRes.ok) {
          toast.error(tu("failed"));
          return;
        }
        onChange(publicUrl);
        return;
      }

      // Sign endpoint refused. 503 storage_disabled = local dev without
      // Supabase env → fall back to the legacy in-function upload route.
      const signBody = await signRes.json().catch(() => ({}));
      if (signBody?.error === "storage_disabled") {
        const fd = new FormData();
        fd.append("file", new File([blob], "image.png", { type: contentType }));
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(
            mapUploadError(body?.error, body?.maxMb ?? 10, body?.maxDim ?? 8000),
          );
          return;
        }
        const { url } = await res.json();
        onChange(url);
        return;
      }

      // Any other sign-endpoint error (auth, too_large, type) — surface it.
      toast.error(
        mapUploadError(signBody?.error, signBody?.maxMb ?? 10, 8000),
      );
    } catch {
      toast.error(tu("failed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div
        className="relative w-full border rounded-md overflow-hidden bg-muted/30 grid place-items-center"
        style={{ aspectRatio: aspect ? String(aspect) : "4 / 3" }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="w-full h-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">{t("dragDrop")}</span>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white shadow cursor-pointer transition-all duration-150 ease-out hover:bg-black/85 hover:scale-110 hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={t("remove")}
            title={t("remove")}
          >
            <X className="h-3 w-3 transition-transform duration-150" />
          </button>
        )}
      </div>

      <div className="flex gap-1 flex-wrap">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-1 min-w-0 h-8 text-xs px-2"
          title={t("upload")}
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span className="truncate">{t("upload")}</span>
        </Button>
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              fetch(value)
                .then((r) => r.blob())
                .then((b) => {
                  const reader = new FileReader();
                  reader.onload = () => setCropSrc(reader.result as string);
                  reader.readAsDataURL(b);
                });
            }}
            disabled={uploading}
            className="h-8 w-8 p-0 shrink-0"
            title={t("crop")}
          >
            <Crop className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        // Server-side `/api/upload` rejects everything outside this list
        // (SVG removed because it can embed scripts → XSS). Keeping client
        // accept in sync gives the user immediate feedback in the file picker.
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onPick}
      />

      <ImageCropDialog
        src={cropSrc}
        aspect={aspect}
        open={!!cropSrc}
        onOpenChange={(o) => !o && setCropSrc(null)}
        onCropped={(blob) => {
          setCropSrc(null);
          uploadBlob(blob);
        }}
      />
    </div>
  );
}
