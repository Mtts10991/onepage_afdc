"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { proxyAvatar } from "@/lib/avatar-url";
import { ImagePicker } from "@/components/onepage/image-picker";
import { Save, Lock } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
}

export function ProfileForm({ user }: { user: User }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(user.name ?? "");
  const [title, setTitle] = useState(user.title ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);

  function saveProfile() {
    start(async () => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, phone, avatarUrl }),
      });
      if (res.ok) {
        toast.success(t("profile.saved"));
        router.refresh();
      } else {
        toast.error(t("common.error"));
      }
    });
  }

  function changePassword(form: FormData) {
    const cur = String(form.get("current"));
    const ne = String(form.get("new"));
    const cf = String(form.get("confirm"));
    if (ne !== cf) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    start(async () => {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: ne }),
      });
      if (res.ok) {
        toast.success(t("profile.passwordChanged"));
        return;
      }
      // Map the stable error codes the API returns into localized messages.
      // Zod password-policy failures come back as a `flatten()` object whose
      // `formErrors[0]` carries one of the codes from `lib/password.ts`.
      const body = await res.json().catch(() => ({}));
      const policy: string | undefined =
        body?.error?.fieldErrors?.newPassword?.[0] ??
        body?.error?.formErrors?.[0];
      const code: string = typeof body?.error === "string" ? body.error : policy ?? "";
      const map: Record<string, string> = {
        invalid_password: t("profile.currentPasswordWrong"),
        same_password: t("profile.samePassword"),
        too_short: t("password.tooShort"),
        too_long: t("password.tooLong"),
        missing_lowercase: t("password.missingLowercase"),
        missing_uppercase: t("password.missingUppercase"),
        missing_digit: t("password.missingDigit"),
      };
      toast.error(map[code] ?? t("common.error"));
    });
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("profile.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">{t("profile.info")}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-[180px_1fr] gap-6">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="w-32 h-32">
              <AvatarImage src={proxyAvatar(avatarUrl) ?? undefined} />
              <AvatarFallback className="text-2xl">
                {(name || user.email).slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="w-full">
              <ImagePicker
                value={avatarUrl}
                aspect={1}
                onChange={(u) => setAvatarUrl(u)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-email">{t("common.email")}</Label>
              <Input
                id="profile-email"
                value={user.email}
                disabled
                autoComplete="email"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="profile-name">{t("common.name")}</Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="profile-title">{t("common.title")}</Label>
                <Input
                  id="profile-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="organization-title"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-phone">{t("common.phone")}</Label>
              <Input
                id="profile-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="pt-2">
              <Button onClick={saveProfile} disabled={pending}>
                <Save className="h-4 w-4" /> {t("profile.updateProfile")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">{t("profile.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={changePassword} className="grid gap-3 max-w-sm">
            <div className="grid gap-1.5">
              <Label htmlFor="pwd-current">{t("profile.currentPassword")}</Label>
              <Input
                id="pwd-current"
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pwd-new">{t("profile.newPassword")}</Label>
              <Input
                id="pwd-new"
                name="new"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                aria-describedby="pwd-new-hint"
              />
              <p id="pwd-new-hint" className="text-xs text-muted-foreground">
                {t("password.hint")}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pwd-confirm">{t("profile.confirmPassword")}</Label>
              <Input
                id="pwd-confirm"
                name="confirm"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <div>
              <Button type="submit" variant="outline" disabled={pending}>
                <Lock className="h-4 w-4" /> {t("profile.changePassword")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
