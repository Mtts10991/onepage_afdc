import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
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

  const data = parseOnePageData(op.data);
  const buf = await exportOnePagePptx(op.title, data);

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
