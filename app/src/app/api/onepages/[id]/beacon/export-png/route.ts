import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { notifyOnePagePublished } from "@/lib/notify";
import { canAccessOnePage } from "@/lib/onepage-access";

/**
 * PNG export is a fully client-side operation (html-to-image runs in the
 * browser), so the only way to count successes/failures on the server is
 * via this beacon. Mirrors the server-side instrumentation of the PPTX
 * route and emits the canonical `onepage.publish` synthetic event on the
 * first successful export of any kind for a given onepage.
 */
const schema = z.object({
  status: z.enum(["success", "failure"]),
  durationMs: z.number().int().nonnegative().max(10 * 60 * 1000).optional(),
  bytes: z.number().int().nonnegative().optional(),
  errorMessage: z.string().max(500).optional(),
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
    return new NextResponse(null, { status: 204 });
  }

  if (parsed.data.status === "success") {
    await audit("onepage.export.success", {
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetId: id,
      metadata: {
        format: "png",
        durationMs: parsed.data.durationMs,
        bytes: parsed.data.bytes,
      },
    });
    const priorPublish = await prisma.auditLog.findFirst({
      where: { event: "onepage.publish", targetId: id },
      select: { id: true },
    });
    if (!priorPublish) {
      await audit("onepage.publish", {
        actorId: session.user.id,
        actorEmail: session.user.email,
        targetId: id,
        metadata: { firstFormat: "png" },
      });
      await notifyOnePagePublished(id, session.user.id);
    }
  } else {
    await audit("onepage.export.failure", {
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetId: id,
      metadata: {
        format: "png",
        durationMs: parsed.data.durationMs,
        errorMessage: parsed.data.errorMessage,
      },
    });
  }

  return new NextResponse(null, { status: 204 });
}
