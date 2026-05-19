import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

/**
 * Waiting room for self-serve LINE registrants. They reach this page
 * because the middleware in auth.config.ts bounces every other route
 * for users with `status = "PENDING"`. The only paths off this page
 * are: wait for admin approval, or sign out.
 *
 * Layout deliberately lives OUTSIDE `(app)` so the sidebar doesn't
 * render — a pending user shouldn't see the nav until approved.
 */
export default async function PendingApprovalPage() {
  const t = await getTranslations("pendingApproval");
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-muted/30 via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="p-6 space-y-4 text-center">
          <div className="mx-auto inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 text-amber-600">
            <Clock className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("body", { email })}
          </p>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              {t("signOut")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
