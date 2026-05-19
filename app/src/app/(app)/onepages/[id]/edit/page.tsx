import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessOnePage } from "@/lib/onepage-access";
import { parseOnePageData } from "@/lib/onepage-schema";
import { OnePageEditor } from "@/components/onepage/onepage-editor";

export default async function EditOnePagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const op = await prisma.onePage.findUnique({ where: { id } });
  if (!op) notFound();
  const access = await canAccessOnePage(session!.user, op.ownerId);
  if (!access.ok || !access.canEdit) notFound();

  return (
    <OnePageEditor
      mode="edit"
      id={op.id}
      initialTitle={op.title}
      initialData={parseOnePageData(op.data)}
      initialServerUpdatedAt={op.updatedAt.toISOString()}
    />
  );
}
