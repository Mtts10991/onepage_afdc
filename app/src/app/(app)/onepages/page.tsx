import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { visibleOnePageWhere } from "@/lib/onepage-access";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pagination } from "@/components/ui/pagination";
import { OnePagesToolbar } from "@/components/onepage/onepages-toolbar";
import { Plus, Edit, Eye } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { proxyAvatar } from "@/lib/avatar-url";
import { parseOnePageData } from "@/lib/onepage-schema";

const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = [10, 25, 50, 100];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    q?: string;
  }>;
}

export default async function OnePagesListPage({ searchParams }: PageProps) {
  const t = await getTranslations();
  const session = await auth();

  // ---- parse + validate searchParams ----
  const sp = await searchParams;
  const rawPage = Number(sp.page ?? 1);
  const rawSize = Number(sp.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = ALLOWED_PAGE_SIZES.includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const q = (sp.q ?? "").trim();

  // ---- build where clause ----
  // Scope mirrors the API guard: own + same-group teammates + admin sees all.
  const baseWhere: Prisma.OnePageWhereInput = await visibleOnePageWhere(
    session!.user,
  );

  const where: Prisma.OnePageWhereInput = q
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { title: { contains: q } },
              { owner: { name: { contains: q } } },
              { owner: { email: { contains: q } } },
              { owner: { title: { contains: q } } },
            ],
          },
        ],
      }
    : baseWhere;

  // ---- parallel: count + list ----
  // ใช้ Promise.all เพื่อให้ count กับ list รันพร้อมกัน — ลด round-trip
  const [total, list] = await Promise.all([
    prisma.onePage.count({ where }),
    prisma.onePage.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            title: true,
            avatarUrl: true,
          },
        },
        // `lastEditedBy` is null until someone other than the original
        // create-time author touches the row. The UI falls back to `owner`
        // in that case so the "Last editor" column never reads as blank.
        lastEditedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("onepage.list")}</h1>
        </div>
        <Button asChild>
          <Link href="/onepages/new">
            <Plus className="h-4 w-4" /> {t("onepage.create")}
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <OnePagesToolbar initialQuery={q} />
        <div className="text-xs text-muted-foreground tabular-nums">
          {t("pagination.totalItems", { total })}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <caption className="sr-only">
              {t("onepage.list")} — {t("pagination.totalItems", { total })}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>{t("onepage.title")}</TableHead>
                <TableHead className="w-28">{t("onepage.type")}</TableHead>
                <TableHead className="w-56">{t("onepage.createdBy")}</TableHead>
                <TableHead className="w-56">{t("onepage.lastEditedBy")}</TableHead>
                <TableHead className="w-40">{t("common.createdAt")}</TableHead>
                <TableHead className="w-40">{t("common.updatedAt")}</TableHead>
                <TableHead className="w-28 text-right">
                  {t("common.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {q ? t("pagination.noResults") : t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
              {list.map((p) => {
                const d = parseOnePageData(p.data);
                const displayName = p.owner.name ?? p.owner.email;
                // Show the actual last editor when present, otherwise fall
                // back to the owner so the column is never empty.
                const editor = p.lastEditedBy ?? p.owner;
                const editorName = editor.name ?? editor.email;
                const editedAt = p.lastEditedAt ?? p.updatedAt;
                // Highlight rows whose latest edit wasn't done by the owner.
                const isCrossOwner =
                  p.lastEditedBy != null && p.lastEditedBy.id !== p.owner.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell>
                      <Badge variant={d.type === "report" ? "default" : "secondary"}>
                        {d.type === "report" ? t("onepage.typeReportShort") : t("onepage.typePlanShort")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={proxyAvatar(p.owner.avatarUrl) ?? undefined} alt={displayName} />
                          <AvatarFallback className="text-xs">
                            {displayName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{displayName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.owner.title ?? "—"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={proxyAvatar(editor.avatarUrl) ?? undefined} alt={editorName} />
                          <AvatarFallback className="text-[10px]">
                            {editorName.slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">
                            {editorName}
                            {isCrossOwner && (
                              <Badge
                                variant="secondary"
                                className="ml-1.5 text-[9px] py-0 px-1 align-middle"
                                title={t("onepage.crossOwnerEditHint")}
                              >
                                {t("onepage.groupEditBadge")}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {formatDate(editedAt)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(p.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`/onepages/${p.id}`}
                          aria-label={`${t("common.preview")}: ${p.title}`}
                          title={t("common.preview")}
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          href={`/onepages/${p.id}/edit`}
                          aria-label={`${t("common.edit")}: ${p.title}`}
                          title={t("common.edit")}
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {total > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              pageSizeOptions={ALLOWED_PAGE_SIZES}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
