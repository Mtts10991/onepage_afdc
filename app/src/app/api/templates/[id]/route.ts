import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { onepageDataSchema } from "@/lib/onepage-schema";

const MAX_DATA_JSON_BYTES = 2 * 1024 * 1024;

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  data: onepageDataSchema.optional(),
});

/**
 * Resolve the template + verify the caller can act on it.
 *
 * - Personal template: only owner (or ADMIN) may read/write/delete.
 * - System template: anyone signed in can read; only ADMIN may write/delete.
 *
 * `mode` distinguishes read-only access (GET) from mutating access (PUT/DELETE).
 */
async function resolve(id: string, mode: "read" | "write") {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };

  const tpl = await prisma.template.findUnique({ where: { id } });
  if (!tpl) return { error: "notfound" as const, status: 404, session };

  const isOwner = tpl.ownerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const canRead = isOwner || isAdmin || tpl.isSystem;
  const canWrite = isOwner || isAdmin;
  // System templates: ADMIN-only writes, even if the template was personal-
  // created by another admin originally.
  const canWriteSystem = tpl.isSystem ? isAdmin : canWrite;

  if (mode === "read" && !canRead) {
    return { error: "forbidden" as const, status: 403, session };
  }
  if (mode === "write" && !canWriteSystem) {
    return { error: "forbidden" as const, status: 403, session };
  }
  return { tpl, session };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolve(id, "read");
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.tpl);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolve(id, "write");
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updates: Prisma.TemplateUpdateInput = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description;
  }
  if (parsed.data.data) {
    const dataJson = JSON.stringify(parsed.data.data);
    if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_JSON_BYTES) {
      return NextResponse.json({ error: "data_too_large" }, { status: 400 });
    }
    updates.data = dataJson;
    // Keep the denormalised `type` in sync if data.type ever changes.
    updates.type = parsed.data.data.type;
  }

  const updated = await prisma.template.update({
    where: { id },
    data: updates,
    select: { id: true, name: true, type: true, isSystem: true },
  });

  await audit("template.update", {
    actorId: r.session?.user.id,
    actorEmail: r.session?.user.email,
    targetId: updated.id,
    metadata: { fields: Object.keys(updates), isSystem: updated.isSystem },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolve(id, "write");
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  await prisma.template.delete({ where: { id } });

  await audit("template.delete", {
    actorId: r.session?.user.id,
    actorEmail: r.session?.user.email,
    targetId: id,
    metadata: { name: r.tpl?.name, isSystem: r.tpl?.isSystem },
  });

  return NextResponse.json({ ok: true });
}
