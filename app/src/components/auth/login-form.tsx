"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";

export function LoginForm() {
  const t = useTranslations();
  const router = useRouter();
  const params = useSearchParams();
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();
  // Inline error state — surfaced via `role="alert"` so screen readers
  // announce it the moment it appears (WCAG 3.3.1 Error Identification).
  // Toasts alone aren't reliable for critical form feedback because they
  // auto-dismiss and live in a region many assistive techs don't poll.
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    startTransition(async () => {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setErrorMsg(t("auth.invalid"));
        return;
      }
      toast.success(t("auth.welcome"));
      router.replace(params.get("callbackUrl") ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <Card className="shadow-xl">
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/*
            Persistent error region. `role="alert"` implies `aria-live=assertive`
            so the message is read immediately. Keeping the node in the tree
            (and toggling visibility via content) gives a more consistent
            screen-reader experience than mounting/unmounting.
          */}
          <div
            role="alert"
            aria-live="assertive"
            className={errorMsg ? "block" : "sr-only"}
          >
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="user@agency.go.th"
              aria-invalid={errorMsg ? true : undefined}
              aria-describedby={errorMsg ? "login-error" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                className="pr-10"
                aria-invalid={errorMsg ? true : undefined}
                aria-describedby={errorMsg ? "login-error" : undefined}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-muted-foreground cursor-pointer transition-all duration-150 ease-out hover:text-foreground hover:bg-muted active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={
                  show ? t("auth.hidePassword") : t("auth.showPassword")
                }
                aria-pressed={show}
                aria-controls="password"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              t("auth.loggingIn")
            ) : (
              <>
                <LogIn className="h-4 w-4" /> {t("auth.submit")}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
