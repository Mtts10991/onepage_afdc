"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnePageEditor } from "./onepage-editor";
import {
  defaultDataFor,
  onepageDataSchema,
  type OnePageData,
  type OnePageType,
} from "@/lib/onepage-schema";
import {
  FileText,
  Camera,
  Sparkles,
  BookmarkCheck,
  Loader2,
} from "lucide-react";

/** Minimal shape the GET /api/templates list returns. */
interface TemplateMeta {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isSystem: boolean;
  updatedAt: string;
}

/**
 * Three-stage flow:
 *   1. choose type (report / plan)
 *   2. choose starting point — blank, or one of the templates for this type
 *   3. render <OnePageEditor> seeded with the chosen data
 *
 * Step 2 is skipped if the user has zero templates available (no system
 * defaults, none of their own) — they go straight to a blank editor.
 */
export function NewOnePageRouter() {
  const t = useTranslations();
  const [type, setType] = useState<OnePageType | null>(null);
  const [seedData, setSeedData] = useState<OnePageData | null>(null);

  // type chosen + seed picked → editor
  if (type && seedData) {
    return (
      <OnePageEditor mode="create" initialTitle="" initialData={seedData} />
    );
  }

  // type chosen, awaiting seed picker
  if (type) {
    return (
      <TemplatePicker
        type={type}
        onCancel={() => setType(null)}
        onPick={(data) => setSeedData(data)}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("onepage.createNew")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("onepage.selectTemplate")}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <TypeCard
          icon={<Camera className="h-5 w-5" />}
          iconClass="bg-amber-500/15 text-amber-700"
          title={t("onepage.typeReport")}
          bullets={[
            t("onepage.reportDescription1"),
            t("onepage.reportDescription2"),
            t("onepage.reportDescription3"),
          ]}
          onClick={() => setType("report")}
        />
        <TypeCard
          icon={<FileText className="h-5 w-5" />}
          iconClass="bg-blue-500/15 text-blue-700"
          title={t("onepage.typePlan")}
          bullets={[
            t("onepage.planDescription1"),
            t("onepage.planDescription2"),
            t("onepage.planDescription3"),
          ]}
          onClick={() => setType("plan")}
        />
      </div>

      <Button variant="ghost" size="sm" onClick={() => history.back()}>
        {t("common.back")}
      </Button>
    </div>
  );
}

function TypeCard({
  icon,
  iconClass,
  title,
  bullets,
  onClick,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  bullets: string[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="anim-slide-up transition-all duration-200 ease-out group-hover:border-primary group-hover:shadow-md group-hover:-translate-y-0.5 group-active:translate-y-0 group-active:shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className={`w-10 h-10 rounded-lg grid place-items-center ${iconClass}`}>
            {icon}
          </div>
          <CardTitle as="h2" className="text-lg">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {bullets.map((b, i) => (
            <p key={i}>{b}</p>
          ))}
        </CardContent>
      </Card>
    </button>
  );
}

/**
 * Step 2 — show "Blank" as the first card, then any templates the user has
 * access to (their own + system defaults) for the chosen type. Picking a
 * card hydrates the editor with the template's `data` snapshot.
 */
function TemplatePicker({
  type,
  onCancel,
  onPick,
}: {
  type: OnePageType;
  onCancel: () => void;
  onPick: (data: OnePageData) => void;
}) {
  const t = useTranslations();
  const [list, setList] = useState<TemplateMeta[] | null>(null);
  const [hydrating, setHydrating] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/templates?type=${type}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: TemplateMeta[]) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  async function pickTemplate(id: string) {
    setHydrating(id);
    try {
      const res = await fetch(`/api/templates/${id}`);
      if (!res.ok) throw new Error("fetch failed");
      const tpl = await res.json();
      // Run the payload through zod so a stale template (saved before a
      // schema change) is normalised against current defaults instead of
      // crashing the editor downstream.
      const parsed = onepageDataSchema.safeParse(JSON.parse(tpl.data));
      if (!parsed.success) throw new Error("invalid template data");
      onPick(parsed.data);
    } catch {
      toast.error(t("templates.loadError"));
      setHydrating(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("templates.pickerTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("templates.pickerDescription")}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Blank option — always available */}
        <button
          type="button"
          onClick={() => onPick(defaultDataFor(type))}
          className="text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        >
          <Card className="anim-slide-up transition-all duration-200 ease-out group-hover:border-primary group-hover:shadow-md group-hover:-translate-y-0.5">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="w-10 h-10 rounded-lg grid place-items-center bg-muted text-muted-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle as="h2" className="text-lg">
                {t("templates.blank")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("templates.blankDescription")}
            </CardContent>
          </Card>
        </button>

        {list === null ? (
          <Card className="grid place-items-center min-h-[120px] text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </Card>
        ) : (
          list.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => pickTemplate(tpl.id)}
              disabled={hydrating !== null}
              className="text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg disabled:opacity-60 disabled:cursor-wait"
            >
              <Card className="anim-slide-up transition-all duration-200 ease-out group-hover:border-primary group-hover:shadow-md group-hover:-translate-y-0.5">
                <CardHeader className="flex flex-row items-center gap-3">
                  <div className="w-10 h-10 rounded-lg grid place-items-center bg-primary/10 text-primary">
                    {hydrating === tpl.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <BookmarkCheck className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <CardTitle as="h2" className="text-lg truncate">
                      {tpl.name}
                    </CardTitle>
                    {tpl.isSystem && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                        {t("templates.systemBadge")}
                      </span>
                    )}
                  </div>
                </CardHeader>
                {tpl.description && (
                  <CardContent className="text-sm text-muted-foreground line-clamp-3">
                    {tpl.description}
                  </CardContent>
                )}
              </Card>
            </button>
          ))
        )}
      </div>

      <Button variant="ghost" size="sm" onClick={onCancel}>
        {t("common.back")}
      </Button>
    </div>
  );
}
