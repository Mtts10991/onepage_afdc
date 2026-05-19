import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Drop the user's bot conduit so we stop pushing notifications. The user
 * remains free to ALSO block the OA on LINE's side — both signals end
 * up at the same state (no future pushes).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, lineBotUserId: true },
  });
  if (!u) return NextResponse.json({ error: "notfound" }, { status: 404 });
  if (!u.lineBotUserId) {
    // Already opted out — return 200 to keep the UI flow idempotent.
    return NextResponse.json({ ok: true, alreadyOptedOut: true });
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { lineBotUserId: null },
  });
  await audit("line.notify.opted_out", {
    actorId: u.id,
    actorEmail: u.email,
    metadata: { source: "profile_ui" },
  });
  return NextResponse.json({ ok: true });
}
