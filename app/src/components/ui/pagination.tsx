"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** หน้าปัจจุบัน (1-indexed) */
  page: number;
  /** จำนวนรายการต่อหน้า */
  pageSize: number;
  /** จำนวนทั้งหมด */
  total: number;
  /** ตัวเลือก pageSize */
  pageSizeOptions?: number[];
}

/**
 * Pagination control —
 *  - First / Prev / Next / Last
 *  - Page size selector
 *  - แสดง "X – Y of Z"
 *  - URL-state: ใช้ query string `page` และ `pageSize` (server-side pagination)
 */
export function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [10, 25, 50, 100],
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  function go(nextPage: number, nextSize?: number) {
    const params = new URLSearchParams(searchParams.toString());
    const ps = nextSize ?? pageSize;
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    if (ps === 25) params.delete("pageSize"); // 25 = default → ไม่ต้องเก็บใน URL
    else params.set("pageSize", String(ps));
    startTransition(() =>
      router.replace(`${pathname}?${params.toString()}`, { scroll: false }),
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 border-t text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>
          {t("pagination.showing", { start, end, total })}
        </span>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="page-size-select"
            className="text-xs text-muted-foreground hidden sm:inline"
          >
            {t("pagination.rowsPerPage")}
          </label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => go(1, Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={pending}
            aria-label={t("pagination.rowsPerPage")}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(1)}
            disabled={pending || safePage <= 1}
            title={t("pagination.first")}
            aria-label={t("pagination.first")}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(safePage - 1)}
            disabled={pending || safePage <= 1}
            title={t("pagination.previous")}
            aria-label={t("pagination.previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-xs tabular-nums px-2 min-w-[80px] text-center">
            {t("pagination.pageOf", { page: safePage, total: totalPages })}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(safePage + 1)}
            disabled={pending || safePage >= totalPages}
            title={t("pagination.next")}
            aria-label={t("pagination.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => go(totalPages)}
            disabled={pending || safePage >= totalPages}
            title={t("pagination.last")}
            aria-label={t("pagination.last")}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
