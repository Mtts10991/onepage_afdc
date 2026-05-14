"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Plus, Trash2 } from "lucide-react";
import { ImagePicker } from "./image-picker";
import type { OnePagePlanData } from "@/lib/onepage-schema";

interface Props {
  value: OnePagePlanData;
  onChange: (v: OnePagePlanData) => void;
}

export function OnePageForm({ value, onChange }: Props) {
  const t = useTranslations("onepage.form");
  const set = <K extends keyof OnePagePlanData>(k: K, v: OnePagePlanData[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <CollapsibleCard id="plan-header" title={t("headerSection")}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("agency")}</Label>
            <Input value={value.agency} onChange={(e) => set("agency", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("date")}</Label>
            <Input
              value={value.date}
              onChange={(e) => set("date", e.target.value)}
              placeholder={t("datePlaceholder")}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("projectName")}</Label>
          <Input
            value={value.projectName}
            onChange={(e) => set("projectName", e.target.value)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("logo")}</Label>
            <ImagePicker
              value={value.logoUrl}
              aspect={1}
              onChange={(url) => set("logoUrl", url)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("image")}</Label>
            <ImagePicker
              value={value.imageUrl}
              aspect={16 / 9}
              onChange={(url) => set("imageUrl", url)}
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard id="plan-body" title={t("bodySection")}>
        {(["background", "objective", "scope", "targetGroup", "responsible"] as const).map(
          (k) => (
            <div key={k} className="space-y-1.5">
              <Label>{t(k)}</Label>
              <Textarea
                value={value[k]}
                rows={2}
                onChange={(e) => set(k, e.target.value)}
              />
            </div>
          )
        )}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("budget")}</Label>
            <Input value={value.budget} onChange={(e) => set("budget", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("timeline")}</Label>
            <Input value={value.timeline} onChange={(e) => set("timeline", e.target.value)} />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        id="plan-kpi"
        title={t("kpi")}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              set("kpis", [...value.kpis, { name: "", target: "" }])
            }
          >
            <Plus className="h-4 w-4" /> {t("addItem")}
          </Button>
        }
      >
        {value.kpis.map((k, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <Input
              placeholder={t("kpi")}
              value={k.name}
              onChange={(e) => {
                const arr = [...value.kpis];
                arr[i] = { ...arr[i], name: e.target.value };
                set("kpis", arr);
              }}
            />
            <Input
              placeholder={t("targetPlaceholder")}
              value={k.target}
              onChange={(e) => {
                const arr = [...value.kpis];
                arr[i] = { ...arr[i], target: e.target.value };
                set("kpis", arr);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => set("kpis", value.kpis.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CollapsibleCard>

      <CollapsibleCard
        id="plan-activities"
        title={t("activities")}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              set("activities", [
                ...value.activities,
                { name: "", period: "", status: "" },
              ])
            }
          >
            <Plus className="h-4 w-4" /> {t("addItem")}
          </Button>
        }
      >
        {value.activities.map((a, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
            <Input
              placeholder={t("activityPlaceholder")}
              value={a.name}
              onChange={(e) => {
                const arr = [...value.activities];
                arr[i] = { ...arr[i], name: e.target.value };
                set("activities", arr);
              }}
            />
            <Input
              placeholder={t("periodPlaceholder")}
              value={a.period}
              onChange={(e) => {
                const arr = [...value.activities];
                arr[i] = { ...arr[i], period: e.target.value };
                set("activities", arr);
              }}
            />
            <Input
              placeholder={t("statusPlaceholder")}
              value={a.status}
              onChange={(e) => {
                const arr = [...value.activities];
                arr[i] = { ...arr[i], status: e.target.value };
                set("activities", arr);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                set("activities", value.activities.filter((_, j) => j !== i))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CollapsibleCard>

      <CollapsibleCard id="plan-outcome" title={t("outcome")}>
        <Textarea
          rows={3}
          value={value.outcome}
          onChange={(e) => set("outcome", e.target.value)}
        />
      </CollapsibleCard>
    </div>
  );
}
