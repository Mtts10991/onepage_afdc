"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" → red button; anything else → default. */
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
}

/**
 * Accessible replacement for `window.confirm()`.
 *
 * Wraps Radix Dialog (focus trap, ESC to close, aria-modal) and exposes the
 * minimal Y/N surface. Use this for destructive actions like deleting a user
 * — `window.confirm` is not focus-trapped, not styled, and on some platforms
 * screen-reader output is inconsistent (WCAG 3.3.4 / 4.1.2).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  onConfirm,
}: Props) {
  const t = useTranslations("common");
  const [pending, setPending] = React.useState(false);

  async function handleConfirm() {
    try {
      setPending(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Radix Dialog already announces as aria-modal; alertdialog hints
        // screen readers that this is decision-blocking.
        role="alertdialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            autoFocus
          >
            {confirmLabel ?? t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
