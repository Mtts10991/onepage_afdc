import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { notifyUserApproved } from "@/lib/notify";

/**
 * Promote a PENDING user to ACTIVE. ADMIN only. Idempotent — if the
 * user is already ACTIVE we return ok without touching the row, so a
 * double-click from the approval list doesn't generate noise.
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
  if (target.status === "ACTIVE") {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }

  await prisma.user.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  await audit("user.approved", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: id,
    metadata: { targetEmail: target.email, previousStatus: target.status },
  });
  // Best-effort — never block the approval on a notify failure.
  await notifyUserApproved(id);

  return NextResponse.json({ ok: true });
}
