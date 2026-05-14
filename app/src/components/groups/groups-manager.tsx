"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Plus, Edit, Trash2, UserPlus, X } from "lucide-react";

interface UserLite {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  avatarUrl: string | null;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  members: { id: string; user: UserLite }[];
}

interface Props {
  groups: GroupRow[];
  allUsers: UserLite[];
}

/**
 * Admin-only management UI for user groups ("สายงาน").
 *
 * The page is laid out as one card per group, each listing its members with
 * a remove (✕) affordance and an "add member" selector. New groups + group
 * deletes happen via the top-level dialog/confirm. All mutations go through
 * the /api/groups[/{id}[/members]] endpoints, which already enforce ADMIN.
 */
export function GroupsManager({ groups, allUsers }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupRow | null>(null);

  async function createGroup(name: string, description: string) {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || undefined }),
    });
    if (res.ok) {
      toast.success(t("groups.created"));
      setCreateOpen(false);
      router.refresh();
    } else {
      toast.error(t("common.error"));
    }
  }

  async function renameGroup(name: string, description: string) {
    if (!editing) return;
    const res = await fetch(`/api/groups/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: description || null }),
    });
    if (res.ok) {
      toast.success(t("groups.saved"));
      setEditing(null);
      router.refresh();
    } else {
      toast.error(t("common.error"));
    }
  }

  async function performDelete(grp: GroupRow) {
    const res = await fetch(`/api/groups/${grp.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("groups.deleted"));
      router.refresh();
    } else {
      toast.error(t("common.error"));
    }
  }

  async function addMember(groupId: string, userId: string) {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      toast.success(t("groups.memberAdded"));
      router.refresh();
    } else {
      toast.error(t("common.error"));
    }
  }

  async function removeMember(groupId: string, userId: string) {
    const res = await fetch(
      `/api/groups/${groupId}/members?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      toast.success(t("groups.memberRemoved"));
      router.refresh();
    } else {
      toast.error(t("common.error"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("groups.pageTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("groups.pageDescription")}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("groups.create")}
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {t("groups.emptyHint")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((grp) => (
            <GroupCard
              key={grp.id}
              group={grp}
              allUsers={allUsers}
              onEdit={() => setEditing(grp)}
              onDelete={() => setDeleteTarget(grp)}
              onAddMember={(uid) => addMember(grp.id, uid)}
              onRemoveMember={(uid) => removeMember(grp.id, uid)}
            />
          ))}
        </div>
      )}

      <GroupFormDialog
        open={createOpen}
        title={t("groups.createTitle")}
        description={t("groups.createDescription")}
        initialName=""
        initialDescription=""
        onCancel={() => setCreateOpen(false)}
        onSubmit={createGroup}
      />

      <GroupFormDialog
        open={!!editing}
        title={t("groups.editTitle")}
        description={t("groups.editDescription")}
        initialName={editing?.name ?? ""}
        initialDescription={editing?.description ?? ""}
        onCancel={() => setEditing(null)}
        onSubmit={renameGroup}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("groups.deleteConfirmTitle")}
        description={
          deleteTarget
            ? t("groups.deleteConfirmDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.delete")}
        variant="destructive"
        onConfirm={async () => {
          if (deleteTarget) await performDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

/** Single-group card with the member list inline. */
function GroupCard({
  group,
  allUsers,
  onEdit,
  onDelete,
  onAddMember,
  onRemoveMember,
}: {
  group: GroupRow;
  allUsers: UserLite[];
  onEdit: () => void;
  onDelete: () => void;
  onAddMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
}) {
  const t = useTranslations();
  const memberIds = new Set(group.members.map((m) => m.user.id));
  const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <Card className="anim-slide-up">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <CardTitle as="h2" className="text-lg truncate">
            {group.name}
          </CardTitle>
          <CardDescription className="text-xs mt-0.5">
            {group.description || (
              <span className="text-muted-foreground/60">—</span>
            )}
          </CardDescription>
          <div className="mt-2 text-xs text-muted-foreground">
            {t("groups.memberCount", { count: group.members.length })}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={t("common.edit")}
            title={t("common.edit")}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            aria-label={t("common.delete")}
            title={t("common.delete")}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1.5">
          {group.members.length === 0 ? (
            <li className="text-xs text-muted-foreground italic">
              {t("groups.noMembers")}
            </li>
          ) : (
            group.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={m.user.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="text-xs">
                    {(m.user.name ?? m.user.email).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">
                    {m.user.name ?? m.user.email}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {m.user.title ?? m.user.email}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onRemoveMember(m.user.id)}
                  aria-label={t("groups.removeMember")}
                  title={t("groups.removeMember")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))
          )}
        </ul>

        {nonMembers.length > 0 && (
          <div className="flex items-center gap-2">
            <UserPlus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  onAddMember(v);
                  e.target.value = "";
                }
              }}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t("groups.addMember")}
            >
              <option value="">{t("groups.addMember")}</option>
              {nonMembers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                  {u.title ? ` (${u.title})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Shared dialog for both create + edit group flows. */
function GroupFormDialog({
  open,
  title,
  description,
  initialName,
  initialDescription,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  initialName: string;
  initialDescription: string;
  onCancel: () => void;
  onSubmit: (name: string, description: string) => Promise<void>;
}) {
  const t = useTranslations();
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);
  const [pending, setPending] = useState(false);

  // Sync inputs to the latest initial values whenever the dialog opens
  // (or a different group is targeted). Clear them on close so the next
  // open starts from a known state.
  useEffect(() => {
    if (open) {
      setName(initialName);
      setDesc(initialDescription);
    } else {
      setName("");
      setDesc("");
    }
  }, [open, initialName, initialDescription]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    try {
      await onSubmit(name.trim(), desc.trim());
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="group-name">{t("groups.fieldName")}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="group-desc">{t("groups.fieldDescription")}</Label>
            <Textarea
              id="group-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
