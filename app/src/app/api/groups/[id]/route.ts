import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };
  if (session.user.role !== "ADMIN")
    return { error: "forbidden" as const, status: 403, session };
  return { session };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, title: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!group) return NextResponse.json({ error: "notfound" }, { status: 404 });
  return NextResponse.json(group);
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await prisma.group.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    },
    select: { id: true, name: true },
  });

  await audit("group.update", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  // Cascading delete from schema removes memberships automatically.
  const grp = await prisma.group.findUnique({ where: { id }, select: { name: true } });
  await prisma.group.delete({ where: { id } });

  await audit("group.delete", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: id,
    metadata: { name: grp?.name },
  });

  return NextResponse.json({ ok: true });
}
