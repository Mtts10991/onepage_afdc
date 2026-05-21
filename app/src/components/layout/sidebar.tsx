"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  BarChart3,
  UserPlus,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  /** Desktop: narrow (icon-only) vs full width. */
  collapsed: boolean;
  /** Desktop: toggle the collapsed width. */
  onToggleCollapsed: () => void;
  /** Mobile: whether the off-canvas drawer is slid in. */
  mobileOpen: boolean;
  /** Mobile: close the drawer (backdrop / nav / close button). */
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data } = useSession();
  const isAdmin = data?.user?.role === "ADMIN";

  // Pending-approval badge — surfaced on the admin "Pending users" nav
  // link so admins notice new self-serve registrations without having
  // to visit the page. Polled every 60s; revalidates instantly after
  // an approve/reject action via router.refresh() from the row itself.
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/pending-users/count", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { count?: number };
        if (!cancelled) setPendingCount(json.count ?? 0);
      } catch {
        // ignore — we just stay on the previous value
      }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAdmin, pathname]);

  const items = [
    { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/onepages", label: t("onepages"), icon: FileText },
    { href: "/onepages/new", label: t("newOnepage"), icon: Plus },
    { href: "/templates", label: t("templates"), icon: Bookmark },
    ...(isAdmin
      ? [
          { href: "/users", label: t("users"), icon: Users },
          {
            href: "/admin/pending-users",
            label: t("pendingUsers"),
            icon: UserPlus,
            badge: pendingCount,
          },
          { href: "/groups", label: t("groups"), icon: Network },
          { href: "/audit", label: t("audit"), icon: ShieldCheck },
          { href: "/admin/metrics", label: t("metrics"), icon: BarChart3 },
        ]
      : []),
    // Profile is a primary destination for every user (not admin-only), so
    // it belongs in the sidebar — not hidden behind the avatar dropdown,
    // which users were not finding. The dropdown link stays as a secondary
    // entry point (standard avatar-menu convention).
    { href: "/profile", label: t("profile"), icon: User },
  ];

  // หา item ที่ active แบบ longest-match (ป้องกัน prefix ซ้อนกัน เช่น /onepages กับ /onepages/new)
  const activeHref = items
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] transition-[width,transform] duration-300",
        // Desktop: always visible; `collapsed` switches icon-only vs full.
        collapsed ? "md:w-16" : "md:w-53",
        "md:translate-x-0",
        // Mobile: full-width drawer (never icon-only) that slides off-screen
        // when closed. `mobileOpen` controls the slide.
        "w-53",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
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
        {/* Desktop: collapse/expand the sidebar width. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          className="shrink-0 h-8 w-8 hidden md:inline-flex"
          aria-label={t("toggleSidebar")}
          title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        {/* Mobile: close the off-canvas drawer. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onCloseMobile}
          className="shrink-0 h-8 w-8 md:hidden"
          aria-label={t("closeSidebar")}
          title={t("closeSidebar")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <TooltipProvider delayDuration={0}>
          {items.map((item) => {
            const { href, label, icon: Icon } = item;
            const badge: number = "badge" in item ? (item.badge ?? 0) : 0;
            const active = href === activeHref;
            const link = (
              <Link
                href={href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium cursor-pointer",
                  "transition-all duration-150 ease-out active:scale-[0.98]",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted hover:translate-x-0.5",
                  collapsed && "justify-center px-2"
                )}
              >
                <span className="relative shrink-0">
                  <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
                  {badge > 0 && collapsed && (
                    <span
                      className="absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                      aria-label={`${badge}`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{label}</span>
                    {badge > 0 && (
                      <span
                        className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white"
                        aria-label={`${badge}`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </>
                )}
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
