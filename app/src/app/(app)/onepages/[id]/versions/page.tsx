import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessOnePage } from "@/lib/onepage-access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { VersionItem } from "@/components/onepage/version-item";

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const session = await auth();

  const op = await prisma.onePage.findUnique({ where: { id } });
  if (!op) notFound();
  const access = await canAccessOnePage(session!.user, op.ownerId);
  if (!access.ok) notFound();

  const versions = await prisma.onePageVersion.findMany({
    where: { onepageId: id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("onepage.versions")}</h1>
          <p className="text-sm text-muted-foreground">{op.title}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/onepages/${id}`}>
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-2 space-y-2">
          {versions.length === 0 && (
            <div className="text-center text-muted-foreground py-6">
              {t("common.noData")}
            </div>
          )}
          {versions.map((v) => (
            <VersionItem
              key={v.id}
              onepageId={id}
              versionId={v.id}
              note={v.note}
              author={v.author.name ?? v.author.email}
              createdAt={v.createdAt.toISOString()}
              isLatest={v.id === versions[0]?.id}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
