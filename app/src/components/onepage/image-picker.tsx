"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImagePlus, Crop, X } from "lucide-react";
import { ImageCropDialog } from "./image-crop-dialog";
import { proxyAvatar } from "@/lib/avatar-url";

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
  // Real upload progress (0-100) from XHR upload.onprogress. Stays at 100
  // while the server finalizes the response; -1 means no upload in flight.
  const [progress, setProgress] = useState(-1);
  const [dragOver, setDragOver] = useState(false);

  // Read a picked/dropped image file into a data URL and open the crop
  // dialog. Shared by the hidden <input>, the click-to-pick drop zone, and
  // drag-and-drop so all three entry points behave identically.
  function openCropFor(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(tu("typeNotAllowed"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) openCropFor(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) openCropFor(f);
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

  // PUT a blob and report real upload progress. fetch() can't surface
  // upload progress, so we drop to XMLHttpRequest, which fires
  // upload.onprogress with loaded/total byte counts.
  function putWithProgress(
    url: string,
    body: Blob | FormData,
    contentType?: string,
  ): Promise<{ ok: boolean; status: number; text: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      if (contentType) xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () =>
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
      xhr.onerror = () => reject(new Error("network"));
      xhr.onabort = () => reject(new Error("aborted"));
      xhr.send(body);
    });
  }

  async function uploadBlob(blob: Blob) {
    setUploading(true);
    setProgress(0);
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
        const putRes = await putWithProgress(signedUrl, blob, contentType);
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
      setProgress(-1);
    }
  }

  return (
    <div className="space-y-2">
      {/*
        The frame doubles as a click-to-pick + drag-and-drop zone, matching
        the "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก" hint. Previously the hint was
        shown but the frame had no handlers, so clicking it did nothing —
        users had to find the separate button below.
      */}
      <div
        className={`relative w-full border rounded-md overflow-hidden bg-muted/30 grid place-items-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : ""
        }`}
        style={{ aspectRatio: aspect ? String(aspect) : "4 / 3" }}
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label={t("upload")}
      >
        {value ? (
          // proxyAvatar rewrites a LINE CDN url (e.g. a profile picture
          // reused as an image value) through /api/avatar-proxy so CSP
          // img-src 'self' doesn't block it; /uploads and data: pass through.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyAvatar(value) ?? undefined}
            alt=""
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-xs text-muted-foreground">{t("dragDrop")}</span>
        )}
        {value && !uploading && (
          <button
            type="button"
            // stopPropagation: the frame is now a click-to-pick zone, so a
            // bare click here would also re-open the file dialog.
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="absolute top-1 right-1 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white shadow cursor-pointer transition-all duration-150 ease-out hover:bg-black/85 hover:scale-110 hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={t("remove")}
            title={t("remove")}
          >
            <X className="h-3 w-3 transition-transform duration-150" />
          </button>
        )}

        {uploading && (
          <div
            className="absolute inset-0 grid place-items-center gap-2 bg-background/80 backdrop-blur-sm p-4"
            role="status"
            aria-live="polite"
          >
            <div className="w-full max-w-[180px] space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                {/* progress < 0 should never show here, but clamp anyway */}
                <div
                  className="h-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${Math.max(0, progress)}%` }}
                />
              </div>
              <p className="text-center text-xs font-medium text-muted-foreground">
                {progress >= 100
                  ? tu("finalizing")
                  : tu("progress", { percent: Math.max(0, progress) })}
              </p>
            </div>
          </div>
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
