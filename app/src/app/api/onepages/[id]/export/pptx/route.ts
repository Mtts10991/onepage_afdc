import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { notifyOnePagePublished } from "@/lib/notify";
import { canAccessOnePage } from "@/lib/onepage-access";
import { parseOnePageData } from "@/lib/onepage-schema";
import { exportOnePagePptx } from "@/lib/export-pptx";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const op = await prisma.onePage.findUnique({ where: { id } });
  if (!op) return NextResponse.json({ error: "notfound" }, { status: 404 });
  const access = await canAccessOnePage(session.user, op.ownerId);
  if (!access.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const startedAt = performance.now();
  let buf: Buffer;
  try {
    const data = parseOnePageData(op.data);
    buf = await exportOnePagePptx(op.title, data);
  } catch (err) {
    const durationMs = Math.round(performance.now() - startedAt);
    await audit("onepage.export.failure", {
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetId: id,
      metadata: {
        format: "pptx",
        durationMs,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }

  const durationMs = Math.round(performance.now() - startedAt);
  await audit("onepage.export.success", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: id,
    metadata: { format: "pptx", durationMs, bytes: buf.byteLength },
  });

  // Synthesize a single "publish" event the first time a onepage produces
  // any export output — used as the canonical end-of-edit timestamp for the
  // time-to-complete metric. We accept the cheap extra read here since
  // exports are infrequent and the AuditLog is indexed on (event, ...).
  const priorPublish = await prisma.auditLog.findFirst({
    where: { event: "onepage.publish", targetId: id },
    select: { id: true },
  });
  if (!priorPublish) {
    await audit("onepage.publish", {
      actorId: session.user.id,
      actorEmail: session.user.email,
      targetId: id,
      metadata: { firstFormat: "pptx" },
    });
    // Notify the owner that their doc was just published — but only for
    // cross-actor publishes (skip when the owner publishes themselves).
    await notifyOnePagePublished(id, session.user.id);
  }

  // Node 22's `Buffer` typings (and Uint8Array under @types/node 22) don't
  // match the strict WHATWG `BodyInit` lib type that Next pulls in via
  // undici. The runtime accepts both — we just need to convince TS.
  // Casting to `BodyInit` via Blob is safer than `any` because it keeps
  // the public API type, and `new Blob([buf])` is cheap (zero-copy in V8).
  const body = new Blob([new Uint8Array(buf)]);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(op.title)}.pptx"`,
    },
  });
}
