"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { confirmDialog } from "@/lib/confirm";
import { Edit, Trash2, FileText, Camera } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  isSystem: boolean;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Server-computed: whether *this* user is allowed to rename/delete. */
  canEdit: boolean;
}

interface Props {
  templates: TemplateRow[];
  title: string;
  description: string;
}

/**
 * Templates management — list every template the user has access to, with
 * inline rename/delete affordances for the ones they own (or all of them,
 * for admins). Create-new is intentionally not here: templates spawn from
 * the editor's "Save as template" button so they always have real data.
 */
export function TemplatesManager({ templates, title, description }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  // id of the template whose delete request is in flight — drives the
  // per-card spinner and blocks a second click on a slow API round trip.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function saveEdit(name: string, descriptionText: string) {
    if (!editing) return;
    const res = await fetch(`/api/templates/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: descriptionText || null,
      }),
    });
    if (res.ok) {
      toast.success(t("templates.saved"));
      setEditing(null);
      router.refresh();
    } else {
      toast.error(t("common.error"));
    }
  }

  async function performDelete(tpl: TemplateRow) {
    if (deletingId) return;
    setDeletingId(tpl.id);
    try {
      const res = await fetch(`/api/templates/${tpl.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("templates.deleted"));
        router.refresh();
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {t("templates.emptyHint")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="anim-slide-up flex flex-col">
              <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                <div
                  className={
                    tpl.type === "report"
                      ? "w-10 h-10 rounded-lg grid place-items-center bg-amber-500/15 text-amber-700 shrink-0"
                      : "w-10 h-10 rounded-lg grid place-items-center bg-blue-500/15 text-blue-700 shrink-0"
                  }
                >
                  {tpl.type === "report" ? (
                    <Camera className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle as="h2" className="text-base truncate">
                    {tpl.name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {tpl.type === "report"
                        ? t("onepage.typeReport")
                        : t("onepage.typePlan")}
                    </Badge>
                    {tpl.isSystem && (
                      <Badge variant="default" className="text-[10px]">
                        {t("templates.systemBadge")}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-3">
                <CardDescription className="line-clamp-3 min-h-[3em]">
                  {tpl.description || (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </CardDescription>
                <div className="text-xs text-muted-foreground">
                  {t("common.updatedAt")}: {formatDate(tpl.updatedAt)}
                </div>
                {tpl.canEdit && (
                  <div className="flex gap-1 mt-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(tpl)}
                      disabled={deletingId === tpl.id}
                      aria-label={t("common.edit")}
                      title={t("common.edit")}
                    >
                      <Edit className="h-4 w-4" /> {t("common.edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (deletingId) return;
                        const ok = await confirmDialog({
                          title: t("templates.deleteConfirmTitle"),
                          text: t("templates.deleteConfirmDescription", {
                            name: tpl.name,
                          }),
                          confirmLabel: t("common.delete"),
                          variant: "destructive",
                        });
                        if (ok) await performDelete(tpl);
                      }}
                      loading={deletingId === tpl.id}
                      disabled={deletingId === tpl.id}
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                      className="text-destructive hover:text-destructive"
                    >
                      {deletingId === tpl.id ? (
                        t("common.deleting")
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" /> {t("common.delete")}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditDialog
        template={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={saveEdit}
      />

    </div>
  );
}

/**
 * Minimal edit dialog — rename + description only. To change `data`, the
 * user re-saves from the editor with the same name (or we could add a
 * "duplicate" affordance later, but YAGNI for now).
 *
 * State is seeded from `template` and re-synced whenever the prop changes,
 * so opening a different row populates the form with that row's values.
 */
function EditDialog({
  template,
  onOpenChange,
  onSave,
}: {
  template: TemplateRow | null;
  onOpenChange: (o: boolean) => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description ?? "");
    }
  }, [template]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!template || !name.trim()) return;
    setPending(true);
    try {
      await onSave(name.trim(), description.trim());
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={!!template}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("templates.editTitle")}</DialogTitle>
          <DialogDescription>{t("templates.editDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-edit-name">{t("templates.fieldName")}</Label>
            <Input
              id="tpl-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-edit-description">
              {t("templates.fieldDescription")}
            </Label>
            <Textarea
              id="tpl-edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
