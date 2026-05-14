import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { visibleOnePageWhere } from "@/lib/onepage-access";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, History, Users } from "lucide-react";

export default async function DashboardPage() {
  const t = await getTranslations();
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  // Stats scope mirrors the list pages: regular users see their own
  // counts + their groupmates'; admins see system-wide totals.
  const opScope = await visibleOnePageWhere(session!.user);
  const verScope = isAdmin
    ? {}
    : { onepage: opScope }; // proxy the OnePage filter through the relation

  const [onepageCount, versionCount, userCount, recent] = await Promise.all([
    prisma.onePage.count({ where: opScope }),
    prisma.onePageVersion.count({ where: verScope }),
    isAdmin ? prisma.user.count() : Promise.resolve(0),
    prisma.onePage.findMany({
      where: opScope,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = [
    { label: t("nav.onepages"), value: onepageCount, icon: FileText },
    { label: t("onepage.versions"), value: versionCount, icon: History },
    ...(isAdmin
      ? [{ label: t("nav.users"), value: userCount, icon: Users }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("auth.welcome")}, {session?.user?.name ?? session?.user?.email}
          </p>
        </div>
        <Button asChild>
          <Link href="/onepages/new">
            <Plus className="h-4 w-4" /> {t("onepage.create")}
          </Link>
        </Button>
      </div>

      <section aria-label={t("nav.dashboard")}>
        <h2 className="sr-only">{t("nav.dashboard")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.label} className="anim-slide-up">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle
                  as="h3"
                  className="text-sm font-medium text-muted-foreground"
                >
                  {s.label}
                </CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="anim-slide-up" aria-labelledby="recent-onepages-title">
        <CardHeader>
          <CardTitle as="h2" id="recent-onepages-title">
            {t("nav.onepages")}
          </CardTitle>
          <CardDescription>
            {recent.length === 0 ? t("common.noData") : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.map((p) => (
            <Link
              key={p.id}
              href={`/onepages/${p.id}`}
              className="flex items-center justify-between rounded-md border p-3 hover:bg-muted transition-colors"
            >
              <span className="font-medium truncate">{p.title}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(p.updatedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
