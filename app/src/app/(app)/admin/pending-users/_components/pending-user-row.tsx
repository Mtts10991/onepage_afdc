"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { proxyAvatar } from "@/lib/avatar-url";
import { confirmDialog } from "@/lib/confirm";
import { formatDate, formatRelativeTime } from "@/lib/utils";

interface Props {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  registeredAtIso: string;
  registrationSource: string;
}

export function PendingUserRow({
  id,
  email,
  name,
  avatarUrl,
  registeredAtIso,
  registrationSource,
}: Props) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  const proxiedSrc = proxyAvatar(avatarUrl);
  const registeredDate = new Date(registeredAtIso);
  const absolute = formatDate(registeredDate);
  const relative = formatRelativeTime(registeredDate);

  async function call(action: "approve" | "reject") {
    start(async () => {
      try {
        const res = await fetch(`/api/admin/pending-users/${id}/${action}`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(
          action === "approve" ? t("approvedToast") : t("rejectedToast"),
        );
        router.refresh();
      } catch {
        toast.error(t("actionFailed"));
      }
    });
  }

  async function reject() {
    const ok = await confirmDialog({
      title: t("reject"),
      text: t("rejectConfirm", { email }),
      confirmLabel: t("reject"),
      variant: "destructive",
    });
    if (ok) void call("reject");
  }

  return (
    <Card>
      <CardContent className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {proxiedSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proxiedSrc}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-xs font-medium text-muted-foreground">
              {(name ?? email).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">
                {name ?? email}
              </span>
              <SourceBadge source={registrationSource} />
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {email}
            </div>
            <div
              className="text-xs text-muted-foreground"
              title={absolute}
            >
              {t("registeredAt", { relative })}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={reject}
            disabled={pending}
          >
            <X className="h-4 w-4" /> {t("reject")}
          </Button>
          <Button size="sm" onClick={() => call("approve")} disabled={pending}>
            <Check className="h-4 w-4" /> {t("approve")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceBadge({ source }: { source: string }) {
  const t = useTranslations("admin");
  // Colour-key by source so the admin spots "self-serve via LINE" at a
  // glance vs "I created this one myself" without reading.
  const styles: Record<string, string> = {
    line: "bg-emerald-100 text-emerald-700",
    admin_created: "bg-slate-100 text-slate-700",
    credentials: "bg-blue-100 text-blue-700",
    seed: "bg-amber-100 text-amber-800",
  };
  const className = styles[source] ?? styles.admin_created;
  return (
    <span
      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${className}`}
    >
      {t(`source_${source}` as never, { default: source } as never)}
    </span>
  );
}
