import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Groups — administrative grouping of users for shared OnePage edit access.
 * Read: any signed-in user (so client UIs can show which groups they're in).
 * Write (POST/PUT/DELETE): ADMIN only.
 */

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };
  if (session.user.role !== "ADMIN")
    return { error: "forbidden" as const, status: 403, session };
  return { session };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json([], { status: 401 });

  const list = await prisma.group.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true } },
    },
  });
  return NextResponse.json(list);
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.group.create({
    data: { name: parsed.data.name, description: parsed.data.description },
    select: { id: true, name: true },
  });

  await audit("group.create", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: created.id,
    metadata: { name: created.name },
  });

  return NextResponse.json(created);
}
