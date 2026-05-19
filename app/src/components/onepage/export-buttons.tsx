"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Download, FileImage } from "lucide-react";

export function ExportButtons({ id, title }: { id: string; title: string }) {
  const t = useTranslations("onepage");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();

  function exportPptx() {
    start(async () => {
      const toastId = toast.loading(t("creatingPptx"));
      try {
        toast.loading(t("creatingPptxStep1"), { id: toastId });
        const res = await fetch(`/api/onepages/${id}/export/pptx`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.loading(t("creatingPptxStep2"), { id: toastId });
        const blob = await res.blob();
        downloadBlob(blob, `${title}.pptx`);
        toast.success(t("exportPptxSuccess"), { id: toastId });
      } catch (e) {
        console.error("[export-pptx]", e);
        toast.error(t("saveError") + ": " + formatErr(e), { id: toastId });
      }
    });
  }

  function exportPng() {
    start(async () => {
      const toastId = toast.loading(t("creatingPng"));
      const startedAt = performance.now();
      try {
        const node = document.getElementById("onepage-canvas") as HTMLElement | null;
        if (!node) throw new Error("canvas not found");

        // === Step 1/3 — inline images ===
        const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
        const originalSrcs = new Map<HTMLImageElement, string>();

        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i];
          toast.loading(
            t("preparingImages", { current: i + 1, total: imgs.length }),
            { id: toastId, description: `${Math.round(((i + 1) / Math.max(1, imgs.length)) * 33)}%` }
          );
          if (img.src.startsWith("data:")) continue;
          try {
            const dataUrl = await urlToDataUrl(img.src);
            originalSrcs.set(img, img.src);
            img.src = dataUrl;
          } catch (err) {
            console.warn("[export-png] inline failed for", img.src, err);
          }
        }

        // wait images
        await Promise.all(
          imgs.map((img) =>
            img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener("load", () => resolve(), { once: true });
                  img.addEventListener("error", () => resolve(), { once: true });
                })
          )
        );

        // === Step 1.5/3 — pre-warm web fonts ===
        // Without this, `html-to-image` can capture the canvas before
        // Sarabun finishes loading, and the PNG drops back to the
        // system sans-serif while the user is still looking at Sarabun
        // on-screen — a confusing fidelity gap. We cap the wait so a
        // dead font server doesn't block exports forever.
        if (typeof document !== "undefined" && (document as any).fonts?.ready) {
          await Promise.race([
            (document as any).fonts.ready as Promise<void>,
            new Promise<void>((resolve) => setTimeout(resolve, 1500)),
          ]);
        }

        // === Step 2/3 — render to canvas ===
        toast.loading(t("rendering"), { id: toastId, description: "66%" });
        const htmlToImage = await import("html-to-image");
        const rect = node.getBoundingClientRect();

        let dataUrl: string;
        try {
          dataUrl = await htmlToImage.toPng(node, {
            pixelRatio: 2,
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
            backgroundColor: "#ffffff",
            filter: (n) => (n as HTMLElement).tagName !== "SCRIPT",
          });
        } finally {
          for (const [img, src] of originalSrcs) img.src = src;
        }

        // === Step 3/3 — download ===
        toast.loading(tc("saving"), { id: toastId, description: "95%" });
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${title}.png`;
        a.click();

        toast.success(t("exportPngSuccess"), { id: toastId, description: "100%" });
        const durationMs = Math.round(performance.now() - startedAt);
        fetch(`/api/onepages/${id}/beacon/export-png`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "success",
            durationMs,
            // dataUrl is "data:image/png;base64,XXXX" — base64 payload is
            // ~4/3 of the raw byte count, close enough for instrumentation.
            bytes: Math.round((dataUrl.length - "data:image/png;base64,".length) * 0.75),
          }),
          keepalive: true,
        }).catch(() => {});
      } catch (e) {
        console.error("[export-png]", e);
        toast.error(t("saveError") + ": " + formatErr(e), { id: toastId });
        const durationMs = Math.round(performance.now() - startedAt);
        fetch(`/api/onepages/${id}/beacon/export-png`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "failure",
            durationMs,
            errorMessage: formatErr(e).slice(0, 500),
          }),
          keepalive: true,
        }).catch(() => {});
      }
    });
  }

  // ---- helpers ----

  return (
    <>
      <Button variant="outline" onClick={exportPptx} disabled={pending}>
        <Download className="h-4 w-4" /> {t("exportPptx")}
      </Button>
      <Button variant="outline" onClick={exportPng} disabled={pending}>
        <FileImage className="h-4 w-4" /> {t("exportPng")}
      </Button>
    </>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** fetch URL แล้วแปลงเป็น data URL (same-origin) */
async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function formatErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e instanceof Event) {
    const t = e.target as HTMLImageElement | null;
    return `image load failed${t?.src ? ": " + t.src.slice(0, 80) : ""}`;
  }
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
