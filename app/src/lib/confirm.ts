import Swal, { type SweetAlertIcon } from "sweetalert2";

/**
 * App-wide confirm/cancel dialog built on SweetAlert2.
 *
 * One place to keep the styling consistent: the theme is wired to the
 * app's colours (so dark mode just works via the `swal-app` class hook)
 * and the button order / colours match the rest of the UI. Call sites
 * pass only the copy — never re-style SweetAlert per call.
 *
 * Returns a promise that resolves `true` when the user confirms and
 * `false` on cancel / dismiss / ESC / backdrop click.
 *
 * Usage:
 *   if (await confirmDialog({ title: "ลบผู้ใช้?", variant: "destructive" })) {
 *     await doDelete();
 *   }
 */

export interface ConfirmOptions {
  title: string;
  /** Optional body text under the title. */
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" → red confirm button + warning icon. */
  variant?: "default" | "destructive";
  /** Override the icon; defaults follow `variant`. */
  icon?: SweetAlertIcon;
}

export async function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  const isDestructive = opts.variant === "destructive";
  const result = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: opts.icon ?? (isDestructive ? "warning" : "question"),
    showCancelButton: true,
    confirmButtonText: opts.confirmLabel ?? "ยืนยัน",
    cancelButtonText: opts.cancelLabel ?? "ยกเลิก",
    // Destructive actions get a red confirm button; others use the brand
    // colour. Hex values mirror the Tailwind tokens used elsewhere.
    confirmButtonColor: isDestructive ? "#dc2626" : "#1d4ed8",
    cancelButtonColor: "#6b7280",
    reverseButtons: true,
    // The `swal-app` class hook lets globals.scss pin the popup colours to
    // the app theme (incl. dark mode) instead of SweetAlert's white card.
    customClass: {
      popup: "swal-app",
    },
    // Keyboard + backdrop dismissal both count as "cancel".
    allowEscapeKey: true,
    allowOutsideClick: true,
  });
  return result.isConfirmed;
}

/**
 * Lightweight async-aware confirm: runs `action` only if the user
 * confirms. Returns whether the action ran.
 */
export async function confirmThen(
  opts: ConfirmOptions,
  action: () => Promise<void>,
): Promise<boolean> {
  const ok = await confirmDialog(opts);
  if (!ok) return false;
  await action();
  return true;
}
