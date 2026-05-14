"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { cn } from "@/lib/utils";

const KEY = "sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("a11y");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(KEY);
    if (v != null) setCollapsed(v === "1");
  }, []);

  function toggle() {
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
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "pl-16" : "pl-53"
        )}
      >
        <Header />
        <main
          id="main-content"
          tabIndex={-1}
          className="p-3 md:p-3 anim-fade-in focus:outline-none"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
