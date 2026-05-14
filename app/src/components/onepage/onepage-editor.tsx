"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, BookmarkPlus } from "lucide-react";
import Link from "next/link";
import type { OnePageData, OnePagePlanData, OnePageReportData } from "@/lib/onepage-schema";
import { OnePageForm } from "./onepage-form";
import { ReportForm } from "./report-form";
import { OnePagePreviewRouter } from "./onepage-preview-router";
import { PreviewFrame } from "./preview-frame";
import { SaveTemplateDialog } from "./save-template-dialog";

interface Props {
  mode: "create" | "edit";
  id?: string;
  initialTitle: string;
  initialData: OnePageData;
}

export function OnePageEditor({ mode, id, initialTitle, initialData }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [data, setData] = useState<OnePageData>(initialData);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [saveTplOpen, setSaveTplOpen] = useState(false);

  function save() {
    start(async () => {
      try {
        if (mode === "create") {
          const res = await fetch("/api/onepages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title || "Untitled", data }),
          });
          if (!res.ok) throw new Error("create failed");
          const op = await res.json();
          toast.success(t("onepage.saved"));
          router.push(`/onepages/${op.id}`);
          router.refresh();
        } else if (id) {
          const res = await fetch(`/api/onepages/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, data, note: note || undefined }),
          });
          if (!res.ok) throw new Error("update failed");
          toast.success(t("onepage.saved"));
          router.push(`/onepages/${id}`);
          router.refresh();
        }
      } catch (e) {
        toast.error(t("onepage.saveError"));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/onepages">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-md bg-muted">
            {data.type === "report" ? t("onepage.typeReport") : t("onepage.typePlan")}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSaveTplOpen(true)}
            disabled={pending}
            title={t("templates.saveAsTemplate")}
          >
            <BookmarkPlus className="h-4 w-4" /> {t("templates.saveAsTemplate")}
          </Button>
          <Button onClick={save} disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      <SaveTemplateDialog
        open={saveTplOpen}
        onOpenChange={setSaveTplOpen}
        data={data}
      />

      <div className="grid gap-2">
        <Label htmlFor="title">{t("onepage.title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="One Page"
        />
      </div>

      {mode === "edit" && (
        <div className="grid gap-2">
          <Label htmlFor="note">{t("onepage.versionNote")}</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("common.optional")}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-4 min-w-0">
          {data.type === "report" ? (
            <ReportForm
              value={data}
              onChange={(v: OnePageReportData) => setData(v)}
            />
          ) : (
            <OnePageForm
              value={data}
              onChange={(v: OnePagePlanData) => setData(v)}
            />
          )}
        </div>
        <div className="space-y-2 min-w-0 lg:self-start">
          <Label>{t("common.preview")}</Label>
          <PreviewFrame
            width={data.type === "report" ? 794 : 1280}
            height={data.type === "report" ? 1123 : 720}
          >
            <OnePagePreviewRouter data={data} title={title || "—"} />
          </PreviewFrame>
        </div>
      </div>
    </div>
  );
}
