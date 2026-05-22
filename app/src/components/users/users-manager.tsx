"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Edit, Trash2, KeyRound, Power } from "lucide-react";
import { formatDate } from "@/lib/utils";

type User = {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  phone: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: string;
};

/**
 * Submit button for the user form. Lives inside <form action={save}>, so
 * useFormStatus().pending is true for the whole server-action round trip —
 * which disables the button and blocks a duplicate submit on slow networks.
 */
function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function UsersManager({ initialUsers }: { initialUsers: User[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  // id of the user whose toggle/delete request is in flight. Used to show a
  // per-row spinner and block a second click while the API/Supabase round
  // trip is still pending.
  const [actingId, setActingId] = useState<string | null>(null);

  async function refresh() {
    router.refresh();
  }

  async function save(form: FormData) {
    const payload: any = Object.fromEntries(form.entries());
    // Drop an empty / whitespace-only password so editing other fields
    // doesn't force a password change. `.trim()` also catches a value the
    // browser autofilled with only spaces.
    if (!String(payload.password ?? "").trim()) delete payload.password;
    payload.role = payload.role || "USER";

    try {
      const url = editing ? `/api/users/${editing.id}` : "/api/users";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Surface WHY the save failed instead of a generic error. The API
        // returns a zod `flatten()` for validation failures; the most
        // common one here is the password policy (e.g. a browser-autofilled
        // password that lacks an uppercase letter), which would otherwise
        // silently block an unrelated name/role edit.
        const body = await res.json().catch(() => ({}));
        const pwdCode: string | undefined =
          body?.error?.fieldErrors?.password?.[0];
        if (pwdCode) {
          const pwdMap: Record<string, string> = {
            too_short: t("password.tooShort"),
            too_long: t("password.tooLong"),
            missing_lowercase: t("password.missingLowercase"),
            missing_uppercase: t("password.missingUppercase"),
            missing_digit: t("password.missingDigit"),
          };
          toast.error(pwdMap[pwdCode] ?? t("password.invalid"));
          return;
        }
        toast.error(t("common.error"));
        return;
      }
      toast.success(t("users.saved"));
      setOpen(false);
      setEditing(null);
      refresh();
    } catch {
      toast.error(t("common.error"));
    }
  }

  async function toggleActive(u: User) {
    if (actingId) return;
    setActingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!res.ok) {
        toast.error(t("common.error"));
        return;
      }
      refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setActingId(null);
    }
  }

  async function performDelete(u: User) {
    if (actingId) return;
    setActingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("users.deleted"));
        refresh();
      } else {
        toast.error(t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("users.title")}</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4" /> {t("users.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? t("users.edit") : t("users.add")}
              </DialogTitle>
              <DialogDescription>
                {t("users.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <form
              action={save}
              className="grid gap-3"
            >
              {!editing && (
                <div className="grid gap-1.5">
                  <Label htmlFor="user-email">{t("common.email")}</Label>
                  <Input
                    id="user-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="user-name">{t("common.name")}</Label>
                  <Input
                    id="user-name"
                    name="name"
                    defaultValue={editing?.name ?? ""}
                    autoComplete="name"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="user-title">{t("common.title")}</Label>
                  <Input
                    id="user-title"
                    name="title"
                    defaultValue={editing?.title ?? ""}
                    autoComplete="organization-title"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="user-phone">{t("common.phone")}</Label>
                  <Input
                    id="user-phone"
                    name="phone"
                    defaultValue={editing?.phone ?? ""}
                    autoComplete="tel"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="user-role">{t("common.role")}</Label>
                  <select
                    id="user-role"
                    name="role"
                    defaultValue={editing?.role ?? "USER"}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={t("common.role")}
                  >
                    <option value="USER">{t("users.role.user")}</option>
                    <option value="ADMIN">{t("users.role.admin")}</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="user-password">
                  {t("users.password")}{" "}
                  {editing && (
                    <span className="text-xs text-muted-foreground">
                      ({t("users.passwordPlaceholder")})
                    </span>
                  )}
                </Label>
                <Input
                  id="user-password"
                  name="password"
                  type="password"
                  placeholder={editing ? t("users.passwordPlaceholder") : "•••••••"}
                  minLength={editing ? 0 : 8}
                  required={!editing}
                  autoComplete="new-password"
                  aria-describedby="user-password-hint"
                />
                {!editing && (
                  <p id="user-password-hint" className="text-xs text-muted-foreground">
                    {t("password.hint")}
                  </p>
                )}
              </div>
              <DialogFooter>
                <SubmitButton label={t("common.save")} pendingLabel={t("common.saving")} />
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <caption className="sr-only">{t("users.title")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.email")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.role")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.createdAt")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>{u.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="success">{t("common.active")}</Badge>
                    ) : (
                      <Badge variant="destructive">{t("common.inactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(u);
                        setOpen(true);
                      }}
                      disabled={actingId !== null}
                      aria-label={t("users.edit")}
                      title={t("users.edit")}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(u)}
                      loading={actingId === u.id}
                      disabled={actingId !== null}
                      aria-label={u.isActive ? t("users.disable") : t("users.enable")}
                      title={u.isActive ? t("users.disable") : t("users.enable")}
                      aria-pressed={u.isActive}
                    >
                      {actingId === u.id ? null : <Power className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (actingId) return;
                        const ok = await confirmDialog({
                          title: t("common.delete"),
                          text: t("users.deleteConfirm", { email: u.email }),
                          confirmLabel: t("common.delete"),
                          variant: "destructive",
                        });
                        if (ok) await performDelete(u);
                      }}
                      loading={actingId === u.id}
                      disabled={actingId !== null}
                      aria-label={t("common.delete")}
                      title={t("common.delete")}
                    >
                      {actingId === u.id ? null : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
