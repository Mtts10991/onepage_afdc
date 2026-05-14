"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OnePageData } from "@/lib/onepage-schema";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Snapshot of the editor's current data — captured at click time. */
  data: OnePageData;
}

/**
 * Modal for capturing a template name + description, then POSTing the
 * current editor state to /api/templates. We pass `data` in as a prop
 * (not pulled from the editor every render) so the user sees exactly the
 * state they intended to save, even if they edit again before submitting.
 */
export function SaveTemplateDialog({ open, onOpenChange, data }: Props) {
  const t = useTranslations();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSystem, setIsSystem] = useState(false);
  const [pending, start] = useTransition();

  function reset() {
    setName("");
    setDescription("");
    setIsSystem(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    start(async () => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          data,
          isSystem: isAdmin ? isSystem : undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("templates.saved"));
        onOpenChange(false);
        reset();
      } else {
        const body = await res.json().catch(() => ({}));
        const code = typeof body?.error === "string" ? body.error : "";
        toast.error(
          code === "data_too_large"
            ? t("templates.errorTooLarge")
            : t("common.error"),
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("templates.saveTitle")}</DialogTitle>
          <DialogDescription>{t("templates.saveDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="template-name">{t("templates.fieldName")}</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-description">
              {t("templates.fieldDescription")}
            </Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {isAdmin && (
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-md border p-3 hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={isSystem}
                onChange={(e) => setIsSystem(e.target.checked)}
                className="mt-0.5 cursor-pointer accent-primary"
              />
              <span>
                <span className="font-medium">{t("templates.systemFlag")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("templates.systemFlagHint")}
                </span>
              </span>
            </label>
          )}

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
