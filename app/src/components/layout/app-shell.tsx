"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";

const KEY = "sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("a11y");
  const pathname = usePathname();
  // Desktop: sidebar is always visible, `collapsed` toggles its width.
  const [collapsed, setCollapsed] = useState(false);
  // Mobile (< md): the sidebar is an off-canvas drawer. `mobileOpen`
  // slides it in over a backdrop instead of stealing layout width — on a
  // 390px screen a fixed 210px sidebar left almost no room for content.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(KEY);
    if (v != null) setCollapsed(v === "1");
  }, []);

  // Close the mobile drawer on navigation — otherwise it stays open
  // covering the page the user just navigated to.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/*
        Skip-link for keyboard users. Hidden until focused (Tab from page load),
        then visible top-left. Required by WCAG 2.4.1 "Bypass Blocks" so a
        keyboard / screen-reader user can jump past the persistent Sidebar and
        Header into the main content of every page.
      */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {t("skipToContent")}
      </a>

      {/* Backdrop — only on mobile, only when the drawer is open. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/*
        Content padding tracks the sidebar width on desktop only. On mobile
        the sidebar is an overlay, so content is full-width (pl-0).
      */}
      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "md:pl-16" : "md:pl-53"
        )}
      >
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main
          id="main-content"
          tabIndex={-1}
          className="p-3 anim-fade-in focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
