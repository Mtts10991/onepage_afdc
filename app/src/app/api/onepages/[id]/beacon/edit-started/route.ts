import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { canAccessOnePage } from "@/lib/onepage-access";

/**
 * Lightweight beacon fired by the editor when a user opens (or begins
 * authoring) a one-page. Powers the "time-to-complete" metric — paired
 * with the eventual `onepage.publish` event.
 *
 * Fire-and-forget by design; never blocks the editor render.
 */
const schema = z.object({
  mode: z.enum(["create", "edit"]),
  type: z.enum(["plan", "report"]).optional(),
});

export async function POST(
  req: NextRequest,
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

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Beacons accept malformed bodies silently — better to lose a single
    // event than make the editor surface a 400 to the user.
    return new NextResponse(null, { status: 204 });
  }

  await audit("onepage.edit.started", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: id,
    metadata: { mode: parsed.data.mode, type: parsed.data.type ?? null },
  });

  return new NextResponse(null, { status: 204 });
}
