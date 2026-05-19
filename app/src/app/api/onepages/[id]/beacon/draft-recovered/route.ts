import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { canAccessOnePage } from "@/lib/onepage-access";

/**
 * Fired when the editor restores an unsaved local draft for a returning
 * user. Used by the metrics dashboard to count how often the autosave
 * + recovery safety net actually paid off in practice.
 */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const onepage = await prisma.onePage.findUnique({
    where: { id },
    select: { ownerId: true },
  });
  if (!onepage) return NextResponse.json({ error: "notfound" }, { status: 404 });
  const access = await canAccessOnePage(session.user, onepage.ownerId);
  if (!access.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await audit("onepage.draft.recovered", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: id,
  });
  return new NextResponse(null, { status: 204 });
}
