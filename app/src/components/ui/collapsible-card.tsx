"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  title: React.ReactNode;
  /** ปุ่ม / element ที่จะ render ขวาของ header (เช่น "เพิ่มรูป") */
  action?: React.ReactNode;
  defaultOpen?: boolean;
  /** ถ้า true จะ persist state ผ่าน localStorage ด้วย key = `cc-${id}` */
  persist?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleCard({
  id,
  title,
  action,
  defaultOpen = true,
  persist = true,
  children,
  className,
}: Props) {
  const storageKey = `cc-${id}`;
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

  // โหลด state จาก localStorage หลัง mount (กัน hydration mismatch)
  useEffect(() => {
    if (!persist) {
      setMounted(true);
      return;
    }
    try {
      const v = localStorage.getItem(storageKey);
      if (v != null) setOpen(v === "1");
    } catch {}
    setMounted(true);
  }, [persist, storageKey]);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (persist) {
        try {
          localStorage.setItem(storageKey, next ? "1" : "0");
        } catch {}
      }
      return next;
    });
  }

  return (
    <Card className={cn("transition-shadow", open && "shadow-sm", className)}>
      <CardHeader
        className="pb-3 flex flex-row items-center justify-between cursor-pointer select-none gap-2 group"
        onClick={(e) => {
          // ถ้า click ที่ปุ่ม action ภายใน header → ไม่ toggle
          const target = e.target as HTMLElement;
          if (target.closest("[data-cc-action]")) return;
          toggle();
        }}
        role="button"
        aria-expanded={open}
      >
        <CardTitle className="text-base flex items-center gap-2">
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 text-muted-foreground",
              !open && "-rotate-90",
              "group-hover:text-foreground",
            )}
          />
          <span>{title}</span>
        </CardTitle>
        {action && (
          <div data-cc-action onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </CardHeader>
      {/* render ด้วย CSS grid trick → smooth open/close */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{
          gridTemplateRows: mounted && !open ? "0fr" : "1fr",
        }}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <CardContent className="space-y-3">{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}
