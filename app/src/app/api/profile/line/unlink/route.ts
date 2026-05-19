import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Remove the LINE Account link for the current user. We refuse to unlink
 * if the user has no password set, because Credentials would then be the
 * only path back in and a passwordless user could lock themselves out.
 * (Today every user is provisioned with a bcrypt hash, but this check
 * defends future flows that may allow LINE-only users.)
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!u) return NextResponse.json({ error: "notfound" }, { status: 404 });
  if (!u.passwordHash) {
    return NextResponse.json(
      { error: "would_lock_out" },
      { status: 409 },
    );
  }

  const result = await prisma.account.deleteMany({
    where: { userId: u.id, provider: "line" },
  });

  await audit("auth.line.unlinked", {
    actorId: u.id,
    actorEmail: u.email,
    metadata: { removedCount: result.count },
  });

  return NextResponse.json({ ok: true, removed: result.count });
}
