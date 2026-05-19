import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getTranslations } from "next-intl/server";

// Server-side LINE availability check — the LINE button is only rendered
// when the channel is actually configured, so unconfigured environments
// (most dev setups) don't show a button that 500s on click.
const LINE_ENABLED = Boolean(process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET);

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-muted/30 via-background to-muted/30 p-4">
      <div className="w-full max-w-md anim-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg mb-3">
            <span className="text-2xl font-bold">1P</span>
          </div>
          <h1 className="text-2xl font-bold">{t("app.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.subtitle")}</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm lineEnabled={LINE_ENABLED} />
        </Suspense>
      </div>
    </main>
  );
}
