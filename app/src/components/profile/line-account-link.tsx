"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/lib/confirm";

interface Props {
  linked: boolean;
  email: string;
}

/**
 * Self-service LINE account linking. Triggering `signIn("line")` from
 * the profile page kicks off the same OAuth flow as the login page,
 * but with the user already authenticated. The server-side resolver in
 * `src/auth.ts:resolveLineUser` then routes by email:
 *
 *   - LINE email matches THIS user's email → Account row is upserted,
 *     the existing session is preserved as the same user, and the
 *     "linked" state flips on next render.
 *   - LINE email matches a DIFFERENT user → that user's session takes
 *     over (standard OAuth behaviour). The button copy below warns
 *     about this in advance so it isn't a surprise.
 *   - LINE email doesn't match any user → a brand-new PENDING account
 *     is created (admin-approval flow). Again, copy warns up front.
 *
 * The button is purely a CTA — all gating lives server-side. We
 * confirm before triggering signIn so a misclick from a credentials
 * user with the wrong LINE on their phone doesn't silently switch
 * accounts.
 */
export function LineAccountLink({ linked, email }: Props) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, start] = useTransition();

  async function link() {
    // Confirmation step: ปุ่มจะส่งผู้ใช้ออกจาก session ปัจจุบันใน OAuth
    // flow. ถ้าเขาใช้ LINE บัญชีที่ email ไม่ตรง อาจกลายเป็น user คนละคน
    // เลย — บังคับ confirm ก่อนเพื่อกัน misclick.
    const ok = await confirmDialog({
      title: t("lineLink"),
      text: t("lineLinkConfirm", { email }),
      confirmLabel: t("lineLink"),
    });
    if (!ok) return;
    start(async () => {
      await signIn("line", { callbackUrl: "/profile" });
    });
  }

  function unlink() {
    start(async () => {
      try {
        const res = await fetch("/api/profile/line/unlink", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(t("lineUnlinked"));
        router.refresh();
      } catch {
        toast.error(t("lineUnlinkFailed"));
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t("lineAccountTitle")}</div>
            <div className="text-xs text-muted-foreground">
              {linked ? t("lineLinkedDesc") : t("lineUnlinkedDesc", { email })}
            </div>
          </div>
          {linked ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={unlink}
            >
              {t("lineUnlink")}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={pending}
              onClick={link}
              className="bg-[#06C755] hover:bg-[#05b04b] text-white"
            >
              {t("lineLink")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
