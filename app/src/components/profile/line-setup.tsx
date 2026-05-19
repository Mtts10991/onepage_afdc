import { getTranslations } from "next-intl/server";
import { LineAccountLink } from "./line-account-link";
import { LineNotifySettings } from "./line-notify-settings";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";

interface Props {
  /** Has the user linked a LINE OAuth Account row (M2)? */
  accountLinked: boolean;
  /** Has the user added the OA as a friend so notifications can reach them (M3)? */
  notifyEnabled: boolean;
  /** User's email — displayed in the link card so they know which LINE to use. */
  email: string;
  /** Public OA add-friend URL — empty when the OA isn't provisioned yet. */
  addFriendUrl: string;
}

/**
 * Top-level "set up LINE on this account" surface. The two underlying
 * cards (account link + notify opt-in) each do one thing well, but
 * stacked alone they don't tell the user that step 1 is a prerequisite
 * for step 2 — so credentials users who land here cold often add the
 * OA first, then wonder why they never get notifications. The progress
 * header above the cards puts the order in front of the eye.
 */
export async function LineSetup({
  accountLinked,
  notifyEnabled,
  email,
  addFriendUrl,
}: Props) {
  const t = await getTranslations("auth");
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">{t("lineSetupTitle")}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("lineSetupSubtitle")}
          </p>
        </div>
        <ol className="grid sm:grid-cols-2 gap-3 text-xs">
          <Step
            n={1}
            done={accountLinked}
            label={t("lineSetupStep1")}
            description={t("lineSetupStep1Desc")}
          />
          <Step
            n={2}
            done={notifyEnabled}
            label={t("lineSetupStep2")}
            description={t("lineSetupStep2Desc")}
            blocked={!accountLinked}
            blockedHint={t("lineSetupStep2Blocked")}
          />
        </ol>
        <div className="space-y-3">
          <LineAccountLink linked={accountLinked} email={email} />
          {/* Notify card stays visible even before linking so users see
              what's coming, but its action is no-op until the account is
              linked — the component itself respects the OA-add URL gate
              and falls back to "not configured" copy when missing. */}
          <LineNotifySettings
            optedIn={notifyEnabled}
            addFriendUrl={accountLinked ? addFriendUrl : ""}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StepProps {
  n: number;
  done: boolean;
  label: string;
  description: string;
  blocked?: boolean;
  blockedHint?: string;
}

function Step({ n, done, label, description, blocked, blockedHint }: StepProps) {
  return (
    <li
      className={`flex gap-2 rounded-md border p-3 ${
        done
          ? "border-emerald-300 bg-emerald-50/50"
          : blocked
            ? "border-dashed text-muted-foreground"
            : "border-border"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="font-medium">
          {n}. {label}
        </div>
        <div className="text-muted-foreground text-[11px]">
          {blocked && blockedHint ? blockedHint : description}
        </div>
      </div>
    </li>
  );
}
