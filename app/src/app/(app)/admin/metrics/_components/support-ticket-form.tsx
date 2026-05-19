"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["login", "format", "export", "mobile", "other"] as const;
type Category = (typeof CATEGORIES)[number];

export function SupportTicketForm() {
  const t = useTranslations("metrics");
  const router = useRouter();
  const [category, setCategory] = useState<Category>("login");
  const [summary, setSummary] = useState("");
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    start(async () => {
      try {
        const res = await fetch("/api/support-tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, summary }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(t("ticketRecorded"));
        setSummary("");
        router.refresh();
      } catch (err) {
        toast.error(t("ticketFailed"));
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">{t("recordTicket")}</div>
        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1">
            <Label htmlFor="category">{t("category")}</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category_${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="summary">{t("summary")}</Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={500}
              placeholder={t("summaryPlaceholder")}
            />
          </div>
          <Button type="submit" disabled={pending || !summary.trim()}>
            {pending ? t("recording") : t("record")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
