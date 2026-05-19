import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Reject a PENDING user by deleting the row. We audit BEFORE delete so
 * the trail survives the cascade. ADMIN only, and refuses to delete a
 * user that has already moved out of PENDING (e.g. someone else
 * approved them in the meantime) to avoid surprising deletes.
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
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, status: true },
  });
  if (!target) return NextResponse.json({ error: "notfound" }, { status: 404 });
  if (target.status !== "PENDING") {
    return NextResponse.json(
      { error: "not_pending", currentStatus: target.status },
      { status: 409 },
    );
  }

  await audit("user.rejected", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: id,
    metadata: { targetEmail: target.email },
  });
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
