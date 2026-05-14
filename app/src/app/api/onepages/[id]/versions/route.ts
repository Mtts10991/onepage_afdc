import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessOnePage } from "@/lib/onepage-access";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) return NextResponse.json([], { status: 401 });

  const onepage = await prisma.onePage.findUnique({ where: { id } });
  if (!onepage) return NextResponse.json([], { status: 404 });
  const access = await canAccessOnePage(session.user, onepage.ownerId);
  if (!access.ok) return NextResponse.json([], { status: 403 });

  const versions = await prisma.onePageVersion.findMany({
    where: { onepageId: id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(versions);
}
