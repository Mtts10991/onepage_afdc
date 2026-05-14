import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { formatDate } from "@/lib/utils";

const DEFAULT_PAGE_SIZE = 50;
const ALLOWED_PAGE_SIZES = [25, 50, 100, 200];

interface PageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    event?: string;
  }>;
}

/**
 * Admin-only audit trail viewer. Read-only — the table is append-only at the
 * application layer, and this page never offers an edit/delete path.
 */
export default async function AuditPage({ searchParams }: PageProps) {
  const t = await getTranslations();
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const rawPage = Number(sp.page ?? 1);
  const rawSize = Number(sp.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = ALLOWED_PAGE_SIZES.includes(rawSize)
    ? rawSize
    : DEFAULT_PAGE_SIZE;
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const eventFilter = (sp.event ?? "").trim();

  const where: Prisma.AuditLogWhereInput = eventFilter
    ? { event: { contains: eventFilter } }
    : {};

  const [total, list] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("audit.title")}</h1>
        <p className="text-muted-foreground text-sm">
          {t("audit.description")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground tabular-nums">
          {t("pagination.totalItems", { total })}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <caption className="sr-only">{t("audit.title")}</caption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">{t("common.createdAt")}</TableHead>
                <TableHead className="w-48">{t("audit.event")}</TableHead>
                <TableHead className="w-56">{t("audit.actor")}</TableHead>
                <TableHead>{t("audit.target")}</TableHead>
                <TableHead className="w-40">{t("audit.ip")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t("common.noData")}
                  </TableCell>
                </TableRow>
              )}
              {list.map((row) => {
                const variant = pickVariant(row.event);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variant}>{row.event}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="truncate font-medium">
                        {row.actorEmail ?? "—"}
                      </div>
                      <div className="text-muted-foreground truncate">
                        {row.actorId ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="truncate">{row.targetId ?? "—"}</div>
                      {row.metadata && (
                        <div className="text-muted-foreground text-[10px] truncate font-mono">
                          {row.metadata}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {row.ip ?? "—"}
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

/** Colour-code rows so security-relevant events jump out at a glance. */
function pickVariant(
  event: string,
): "default" | "secondary" | "destructive" | "success" {
  if (event.endsWith(".failure") || event.endsWith(".rate_limited")) {
    return "destructive";
  }
  if (event.endsWith(".success") || event.endsWith(".create")) {
    return "success";
  }
  if (event.endsWith(".delete")) return "destructive";
  return "secondary";
}
