import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TemplatesManager } from "@/components/templates/templates-manager";

/**
 * Templates list page — shows the user's own + every system template.
 * Mutation (rename / delete) happens through the client component.
 */
export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;

  // Visibility rule (matches the OnePage list page):
  //   - regular user → their own templates + every system template
  //   - admin        → everything, so they can audit and clean up
  const where: Prisma.TemplateWhereInput = isAdmin
    ? {}
    : { OR: [{ ownerId: userId }, { isSystem: true }] };

  const rows = await prisma.template.findMany({
    where,
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      isSystem: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serialized = rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    canEdit: r.isSystem ? isAdmin : r.ownerId === userId || isAdmin,
  }));

  // Pre-translate page-level strings so the client component doesn't have
  // to refetch the i18n namespace just for the page title.
  const t = await getTranslations("templates");
  return (
    <TemplatesManager
      templates={serialized}
      title={t("pageTitle")}
      description={t("pageDescription")}
    />
  );
}
