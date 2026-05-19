"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, ArrowLeft, BookmarkPlus } from "lucide-react";
import Link from "next/link";
import type { OnePageData, OnePagePlanData, OnePageReportData } from "@/lib/onepage-schema";
import { OnePageForm } from "./onepage-form";
import { ReportForm } from "./report-form";
import { OnePagePreviewRouter } from "./onepage-preview-router";
import { PreviewFrame } from "./preview-frame";
import { SaveTemplateDialog } from "./save-template-dialog";
import {
  clearLocalDraft,
  readLocalDraft,
  useAutosaveDraft,
  type DraftSnapshot,
} from "./use-autosave-draft";

interface Props {
  mode: "create" | "edit";
  id?: string;
  initialTitle: string;
  initialData: OnePageData;
  /** Server's row.updatedAt at fetch time — drives optimistic concurrency. */
  initialServerUpdatedAt?: string;
}

export function OnePageEditor({
  mode,
  id,
  initialTitle,
  initialData,
  initialServerUpdatedAt,
}: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [title, setTitle] = useState(initialTitle);
  const [data, setData] = useState<OnePageData>(initialData);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [saveTplOpen, setSaveTplOpen] = useState(false);

  // Draft recovery offer. We populate this from localStorage once on
  // mount and let the user pick: accept the local draft, or discard it
  // and keep the server snapshot. Until they pick, autosave is paused
  // so the recovery option isn't silently overwritten.
  const [recoverOffer, setRecoverOffer] = useState<DraftSnapshot | null>(null);
  useEffect(() => {
    if (mode !== "edit" || !id || !initialServerUpdatedAt) return;
    const draft = readLocalDraft(id);
    if (!draft) return;
    // Only offer recovery when the draft was based on the SAME server
    // revision we just fetched — otherwise the draft is stale relative
    // to whoever saved last (likely the same user on another device)
    // and recovering would silently undo their work.
    if (draft.baseUpdatedAt !== initialServerUpdatedAt) {
      clearLocalDraft(id);
      return;
    }
    setRecoverOffer(draft);
  }, [mode, id, initialServerUpdatedAt]);

  const autosave = useAutosaveDraft({
    id,
    data,
    title,
    initialServerUpdatedAt: initialServerUpdatedAt ?? "",
    enabled: mode === "edit" && !!id && !recoverOffer,
  });

  // Surface conflict state once, then leave the badge as the standing
  // signal until the user reloads.
  const conflictToastedRef = useRef(false);
  useEffect(() => {
    if (autosave.status === "conflict" && !conflictToastedRef.current) {
      conflictToastedRef.current = true;
      toast.error(t("onepage.autosaveConflict"), {
        duration: 8000,
        action: {
          label: t("onepage.autosaveReload"),
          onClick: () => router.refresh(),
        },
      });
    }
  }, [autosave.status, router, t]);

  // Beacon: emit one "edit started" event per editor mount on an existing
  // onepage. For create-mode we wait until the first save returns an id —
  // there's no targetId to attribute the event to until then. The ref
  // prevents double-firing in React 19 strict-mode / dev re-renders.
  const editStartedFiredRef = useRef(false);
  useEffect(() => {
    if (mode !== "edit" || !id) return;
    if (editStartedFiredRef.current) return;
    editStartedFiredRef.current = true;
    fetch(`/api/onepages/${id}/beacon/edit-started`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "edit", type: initialData.type }),
      keepalive: true,
    }).catch(() => {
      // beacon is best-effort
    });
  }, [mode, id, initialData.type]);

  function acceptRecovery() {
    if (!recoverOffer || !id) return;
    setData(recoverOffer.data);
    setTitle(recoverOffer.title);
    setRecoverOffer(null);
    // Fire-and-forget audit so the dashboard can count recoveries.
    fetch(`/api/onepages/${id}/beacon/draft-recovered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {});
  }

  function discardRecovery() {
    if (!id) return;
    clearLocalDraft(id);
    setRecoverOffer(null);
  }

  function save() {
    start(async () => {
      try {
        if (mode === "create") {
          const res = await fetch("/api/onepages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: title || "Untitled", data }),
          });
          if (!res.ok) throw new Error("create failed");
          const op = await res.json();
          // Fire the create-mode start beacon now that we have a targetId.
          // Time-to-complete for create-mode includes only the post-save
          // interval — accept that limitation in BASELINE.md.
          fetch(`/api/onepages/${op.id}/beacon/edit-started`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "create", type: data.type }),
            keepalive: true,
          }).catch(() => {});
          toast.success(t("onepage.saved"));
          router.push(`/onepages/${op.id}`);
          router.refresh();
        } else if (id) {
          // Flush any pending debounced autosave first, then send the
          // explicit save with the note so it lands as a proper version
          // row (not a coalesced [autosave] one).
          await autosave.flush();
          const res = await fetch(`/api/onepages/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              data,
              note: note || undefined,
              expectedUpdatedAt: autosave.serverUpdatedAt || undefined,
            }),
          });
          if (res.status === 409) {
            toast.error(t("onepage.autosaveConflict"));
            return;
          }
          if (!res.ok) throw new Error("update failed");
          clearLocalDraft(id);
          toast.success(t("onepage.saved"));
          router.push(`/onepages/${id}`);
          router.refresh();
        }
      } catch (e) {
        toast.error(t("onepage.saveError"));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/onepages">
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-md bg-muted">
            {data.type === "report" ? t("onepage.typeReport") : t("onepage.typePlan")}
          </span>
          {mode === "edit" && <AutosaveBadge status={autosave.status} />}
          <Button
            type="button"
            variant="outline"
            onClick={() => setSaveTplOpen(true)}
            disabled={pending}
            title={t("templates.saveAsTemplate")}
          >
            <BookmarkPlus className="h-4 w-4" /> {t("templates.saveAsTemplate")}
          </Button>
          <Button onClick={save} disabled={pending}>
            <Save className="h-4 w-4" /> {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </div>

      {recoverOffer && (
        <div className="rounded-md border border-amber-400 bg-amber-50 p-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex-1 min-w-0">
            {t("onepage.draftRecoverPrompt", {
              when: new Date(recoverOffer.dirtyAt).toLocaleString(),
            })}
          </span>
          <Button size="sm" onClick={acceptRecovery}>
            {t("onepage.draftRecoverAccept")}
          </Button>
          <Button size="sm" variant="outline" onClick={discardRecovery}>
            {t("onepage.draftRecoverDiscard")}
          </Button>
        </div>
      )}

      <SaveTemplateDialog
        open={saveTplOpen}
        onOpenChange={setSaveTplOpen}
        data={data}
      />

      <div className="grid gap-2">
        <Label htmlFor="title">{t("onepage.title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="One Page"
        />
      </div>

      {mode === "edit" && (
        <div className="grid gap-2">
          <Label htmlFor="note">{t("onepage.versionNote")}</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("common.optional")}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] gap-6">
        <div className="space-y-4 min-w-0">
          {data.type === "report" ? (
            <ReportForm
              value={data}
              onChange={(v: OnePageReportData) => setData(v)}
            />
          ) : (
            <OnePageForm
              value={data}
              onChange={(v: OnePagePlanData) => setData(v)}
            />
          )}
        </div>
        <div className="space-y-2 min-w-0 lg:self-start">
          <Label>{t("common.preview")}</Label>
          <PreviewFrame
            width={data.type === "report" ? 794 : 1280}
            height={data.type === "report" ? 1123 : 720}
          >
            <OnePagePreviewRouter data={data} title={title || "—"} />
          </PreviewFrame>
        </div>
      </div>
    </div>
  );
}

function AutosaveBadge({ status }: { status: ReturnType<typeof useAutosaveDraft>["status"] }) {
  const t = useTranslations("onepage");
  const map: Record<typeof status, { label: string; className: string }> = {
    idle: { label: "", className: "" },
    dirty: { label: t("autosaveDirty"), className: "bg-muted text-muted-foreground" },
    saving: { label: t("autosaveSaving"), className: "bg-blue-100 text-blue-700" },
    saved: { label: t("autosaveSaved"), className: "bg-emerald-100 text-emerald-700" },
    conflict: { label: t("autosaveConflictBadge"), className: "bg-amber-100 text-amber-800" },
    error: { label: t("autosaveError"), className: "bg-red-100 text-red-700" },
  };
  const v = map[status];
  if (!v.label) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`text-xs px-2 py-1 rounded-md ${v.className}`}
    >
      {v.label}
    </span>
  );
}
