"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useTranslations } from "next-intl";

export function VersionItem({
  onepageId,
  versionId,
  note,
  author,
  createdAt,
  isLatest,
}: {
  onepageId: string;
  versionId: string;
  note: string | null;
  author: string;
  createdAt: string;
  isLatest: boolean;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [pending, start] = useTransition();

  function restore() {
    start(async () => {
      const res = await fetch(
        `/api/onepages/${onepageId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        toast.error(t("onepage.saveError"));
        return;
      }
      toast.success(t("onepage.restored"));
      router.push(`/onepages/${onepageId}`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{author}</span>
          {isLatest && <Badge variant="success">{t("common.latest")}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(createdAt)} {note ? `· ${note}` : ""}
        </div>
      </div>
      {!isLatest && (
        <Button
          variant="outline"
          size="sm"
          onClick={restore}
          disabled={pending}
        >
          <RotateCcw className="h-4 w-4" /> {t("onepage.restore")}
        </Button>
      )}
    </div>
  );
}
