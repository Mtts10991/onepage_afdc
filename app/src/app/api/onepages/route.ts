import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { visibleOnePageWhere } from "@/lib/onepage-access";
import { defaultPlanData, onepageDataSchema } from "@/lib/onepage-schema";

/**
 * Cap the JSON payload size that callers can persist into `OnePage.data`.
 * Without a bound a malicious (or buggy) client can store arbitrarily large
 * blobs, bloating the SQLite file and slowing every subsequent page load.
 * 2 MB is comfortably more than a fully populated report (with embedded
 * data-URL logos would be larger, but we use `/uploads/*` URLs instead).
 */
const MAX_DATA_JSON_BYTES = 2 * 1024 * 1024;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json([], { status: 401 });

  // Visibility rule (matches /onepages page + templates list):
  //   - regular user → own + same-group teammates
  //   - admin        → everything
  const list = await prisma.onePage.findMany({
    where: await visibleOnePageWhere(session.user),
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      createdAt: true,
      thumbnail: true,
    },
  });
  return NextResponse.json(list);
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  data: onepageDataSchema.optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data.data ?? defaultPlanData;
  const dataJson = JSON.stringify(data);

  // Defence-in-depth size check after JSON serialization — zod limits the
  // *shape* but not the cumulative byte size.
  if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_JSON_BYTES) {
    return NextResponse.json({ error: "data_too_large" }, { status: 400 });
  }

  const created = await prisma.onePage.create({
    data: {
      title: parsed.data.title,
      ownerId: session.user.id,
      // Seed the audit fields at creation time so list views always have
      // something to render — they get overwritten on each subsequent edit.
      lastEditedById: session.user.id,
      lastEditedAt: new Date(),
      data: dataJson,
      versions: {
        create: {
          authorId: session.user.id,
          data: dataJson,
          note: "created",
        },
      },
    },
  });

  await audit("onepage.create", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: created.id,
    metadata: { title: created.title, type: data.type },
  });

  return NextResponse.json(created);
}
