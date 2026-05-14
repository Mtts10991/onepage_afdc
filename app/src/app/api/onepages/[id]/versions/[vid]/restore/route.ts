import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { canAccessOnePage } from "@/lib/onepage-access";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; vid: string }> }
) {
  const { id, vid } = await ctx.params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const onepage = await prisma.onePage.findUnique({ where: { id } });
  if (!onepage) return NextResponse.json({ error: "notfound" }, { status: 404 });
  const access = await canAccessOnePage(session.user, onepage.ownerId);
  if (!access.ok || !access.canEdit) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const version = await prisma.onePageVersion.findUnique({ where: { id: vid } });
  // IDOR guard: a version belongs to exactly one onepage. Reject any
  // mismatch even if the caller knows both ids.
  if (!version || version.onepageId !== id) {
    return NextResponse.json({ error: "version_notfound" }, { status: 404 });
  }

  const editorId = session.user.id;
  const isCrossOwner = access.isCrossOwner;

  const restored = await prisma.$transaction(async (tx) => {
    const op = await tx.onePage.update({
      where: { id },
      data: {
        data: version.data,
        lastEditedById: editorId,
        lastEditedAt: new Date(),
      },
    });
    await tx.onePageVersion.create({
      data: {
        onepageId: id,
        authorId: editorId,
        data: version.data,
        note: isCrossOwner
          ? `[group-restore by ${session.user.email ?? editorId}] restored from ${vid}`
          : `restored from ${vid}`,
      },
    });
    return op;
  });

  await audit("onepage.restore", {
    actorId: editorId,
    actorEmail: session.user.email,
    targetId: id,
    metadata: {
      fromVersionId: vid,
      crossOwner: isCrossOwner,
      ownerId: onepage.ownerId,
    },
  });

  return NextResponse.json(restored);
}
