"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  /** True when the user is already a friend of the OA. */
  optedIn: boolean;
  /**
   * Public deep-link to the LINE Official Account (e.g. line.me/R/ti/p/@xxx).
   * Empty string when the OA isn't configured yet — UI degrades to a
   * "not configured" notice rather than a broken button.
   */
  addFriendUrl: string;
}

/**
 * Notification opt-in card. The OA-add step is handled entirely on
 * LINE's side — we just link out. The webhook (src/app/api/line/webhook)
 * captures the user the moment they tap "Add Friend", so the only thing
 * this card does locally is the OPT-OUT (drop `lineBotUserId`).
 */
export function LineNotifySettings({ optedIn, addFriendUrl }: Props) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, start] = useTransition();
  const configured = Boolean(addFriendUrl);

  function optOut() {
    start(async () => {
      try {
        const res = await fetch("/api/profile/line/notify-opt-out", {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(t("lineNotifyOptedOut"));
        router.refresh();
      } catch {
        toast.error(t("lineNotifyOptOutFailed"));
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-sm font-medium">{t("lineNotifyTitle")}</div>
        {!configured ? (
          <p className="text-xs text-muted-foreground">
            {t("lineNotifyNotConfigured")}
          </p>
        ) : optedIn ? (
          <>
            <p className="text-xs text-muted-foreground">
              {t("lineNotifyOptedInDesc")}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={optOut}
            >
              {t("lineNotifyOptOut")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t("lineNotifyOptInDesc")}
            </p>
            <Button asChild className="bg-[#06C755] hover:bg-[#05b04b] text-white">
              <a href={addFriendUrl} target="_blank" rel="noopener noreferrer">
                {t("lineNotifyAddFriend")}
              </a>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
