import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };
  if (session.user.role !== "ADMIN")
    return { error: "forbidden" as const, status: 403, session };
  return { session };
}

const updateSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Allow-listed assignment — never spread parsed.data straight into Prisma.
  // Even though zod already prunes unknown keys, the explicit list documents
  // exactly which columns this endpoint is allowed to touch (defence in depth
  // against future schema additions that might be sensitive, e.g. ownership
  // fields, hashed tokens, billing flags, etc.).
  const updates: Prisma.UserUpdateInput = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
  if (parsed.data.role !== undefined) updates.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.password) {
    updates.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const u = await prisma.user.update({ where: { id }, data: updates });
  await audit("user.update", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: u.id,
    metadata: {
      // Don't log the actual new password — only that one was set.
      fields: Object.keys(updates),
      passwordChanged: Boolean(parsed.data.password),
    },
  });
  return NextResponse.json({ id: u.id });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  if (g.session?.user.id === id)
    return NextResponse.json({ error: "self_delete" }, { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id },
    select: { email: true },
  });
  await prisma.user.delete({ where: { id } });
  await audit("user.delete", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: id,
    metadata: { email: target?.email },
  });
  return NextResponse.json({ ok: true });
}
