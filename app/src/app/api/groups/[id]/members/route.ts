import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Membership management. Add by POSTing `{ userId }`; remove with DELETE.
 *
 * Admin-only — these are the rows that grant cross-owner visibility, so
 * anything less than admin would let users escalate their own access.
 */

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };
  if (session.user.role !== "ADMIN")
    return { error: "forbidden" as const, status: 403, session };
  return { session };
}

const addSchema = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await ctx.params;
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // `upsert` makes the endpoint idempotent — re-adding the same user is a
  // no-op rather than a 500 from the unique constraint.
  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId: parsed.data.userId, groupId } },
    create: { userId: parsed.data.userId, groupId },
    update: {},
  });

  await audit("group.member.add", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: groupId,
    metadata: { userId: parsed.data.userId },
  });

  return NextResponse.json({ ok: true });
}

const removeSchema = z.object({ userId: z.string().min(1) });

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await ctx.params;
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  // Accept the userId both as a query string (?userId=...) and as a JSON
  // body — query is friendlier from fetch() callers that don't want to
  // attach a body to a DELETE.
  const url = new URL(req.url);
  let userId = url.searchParams.get("userId") ?? "";
  if (!userId) {
    const body = await req.json().catch(() => ({}));
    const parsed = removeSchema.safeParse(body);
    if (parsed.success) userId = parsed.data.userId;
  }
  if (!userId)
    return NextResponse.json({ error: "missing_userId" }, { status: 400 });

  await prisma.groupMembership
    .delete({ where: { userId_groupId: { userId, groupId } } })
    .catch(() => null); // already gone → still a 200

  await audit("group.member.remove", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: groupId,
    metadata: { userId },
  });

  return NextResponse.json({ ok: true });
}
