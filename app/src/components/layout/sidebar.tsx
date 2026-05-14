"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
  Bookmark,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data } = useSession();
  const isAdmin = data?.user?.role === "ADMIN";

  const items = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/onepages", label: t("onepages"), icon: FileText },
    { href: "/onepages/new", label: t("newOnepage"), icon: Plus },
    { href: "/templates", label: t("templates"), icon: Bookmark },
    ...(isAdmin
      ? [
          { href: "/users", label: t("users"), icon: Users },
          { href: "/groups", label: t("groups"), icon: Network },
          { href: "/audit", label: t("audit"), icon: ShieldCheck },
        ]
      : []),
  ];

  // หา item ที่ active แบบ longest-match (ป้องกัน prefix ซ้อนกัน เช่น /onepages กับ /onepages/new)
  const activeHref = items
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] transition-[width] duration-300",
        collapsed ? "w-16" : "w-53"
      )}
    >
      <div
        className={cn(
          "border-b",
          collapsed
            ? "flex flex-col items-center gap-1 py-2"
            : "flex items-center justify-between h-14 px-3"
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 min-w-0"
          title="OnePage"
        >
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0 font-bold">
            1P
          </div>
          {!collapsed && <span className="font-semibold truncate">OnePage</span>}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="shrink-0 h-8 w-8"
          aria-label={t("toggleSidebar")}
          title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <TooltipProvider delayDuration={0}>
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === activeHref;
            const link = (
              <Link
                href={href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer",
                  "transition-all duration-150 ease-out active:scale-[0.98]",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted hover:translate-x-0.5",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={href}>{link}</div>
            );
          })}
        </TooltipProvider>
      </nav>

      <div className="p-3 border-t text-xs text-muted-foreground">
        {!collapsed && <span>v0.1.0</span>}
      </div>
    </aside>
  );
}
