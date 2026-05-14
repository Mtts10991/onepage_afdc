import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessOnePage } from "@/lib/onepage-access";
import { parseOnePageData } from "@/lib/onepage-schema";
import { OnePagePreviewRouter } from "@/components/onepage/onepage-preview-router";
import { ExportButtons } from "@/components/onepage/export-buttons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/utils";

export default async function OnePageDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const session = await auth();
  const op = await prisma.onePage.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, title: true } },
      lastEditedBy: { select: { id: true, name: true, email: true } },
    },
  });
  if (!op) notFound();
  // notFound() (not forbidden) on no-access so attackers can't probe ids.
  const access = await canAccessOnePage(session!.user, op.ownerId);
  if (!access.ok) notFound();

  const data = parseOnePageData(op.data);
  const editor = op.lastEditedBy ?? op.owner;
  const editorName = editor.name ?? editor.email;
  const editedAt = op.lastEditedAt ?? op.updatedAt;
  const isCrossOwner =
    op.lastEditedBy != null && op.lastEditedBy.id !== op.owner.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{op.title}</h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
              {data.type === "report" ? t("onepage.typeReport") : t("onepage.typePlan")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("onepage.ownerLabel")}: <span className="font-medium text-foreground">{op.owner.name ?? op.owner.email}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {t("onepage.lastEditedBy")}: <span className="font-medium text-foreground">{editorName}</span>
              {" · "}
              <time dateTime={editedAt.toISOString()}>{formatDate(editedAt)}</time>
              {isCrossOwner && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-[9px] py-0 px-1 align-middle"
                  title={t("onepage.crossOwnerEditHint")}
                >
                  {t("onepage.groupEditBadge")}
                </Badge>
              )}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline">
            <Link href={`/onepages/${op.id}/versions`}>
              <History className="h-4 w-4" /> {t("onepage.versions")}
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/onepages/${op.id}/edit`}>
              <Edit className="h-4 w-4" /> {t("common.edit")}
            </Link>
          </Button>
          <ExportButtons id={op.id} title={op.title} />
        </div>
      </div>

      <div className="overflow-auto">
        <OnePagePreviewRouter data={data} title={op.title} />
      </div>
    </div>
  );
}
