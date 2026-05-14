"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

/**
 * Toolbar สำหรับหน้า /onepages —
 *  - Search box (debounced 300ms) → push ค่าเป็น query string `q`
 *  - กลับไปหน้า 1 อัตโนมัติเมื่อพิมพ์ใหม่
 *  - ใช้ useTransition เพื่อแสดง pending state ระหว่างที่ server component re-fetch
 */
export function OnePagesToolbar({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  // debounce
  useEffect(() => {
    const id = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      params.delete("page"); // reset page เมื่อ query เปลี่ยน
      const next = `${pathname}?${params.toString()}`;
      const current = `${pathname}?${searchParams.toString()}`;
      if (next === current) return;
      startTransition(() => router.replace(next, { scroll: false }));
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("common.searchPlaceholder")}
        className="pl-8 pr-8"
      />
      {pending && (
        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
      )}
    </div>
  );
}
