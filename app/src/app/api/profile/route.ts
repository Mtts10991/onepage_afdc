import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Restrict avatarUrl to URLs we control. Without this, a malicious user can
 * point their avatar at any external host — including IP-restricted internal
 * hosts (cloud metadata service, internal admin tools) — which the server
 * may then fetch when generating PPTX or rendering server-side previews.
 *
 * Also rejects `javascript:` and `data:` (the latter could carry SVG XSS in
 * an <img> tag at some sites; we only need /uploads/ paths here).
 */
const avatarUrlSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => v == null || v === "" || /^\/uploads\/[A-Za-z0-9._-]+$/.test(v),
    { message: "invalid_avatar_url" },
  );

const updateSchema = z.object({
  name: z.string().max(120).optional(),
  title: z.string().max(120).optional(),
  phone: z.string().max(32).optional(),
  avatarUrl: avatarUrlSchema,
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      phone: true,
      avatarUrl: true,
      role: true,
    },
  });
  return NextResponse.json(u);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Allow-listed assignment (defence-in-depth vs. mass assignment) —
  // never let role/passwordHash/isActive flow through this self-service endpoint.
  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone;
  if (parsed.data.avatarUrl !== undefined) data.avatarUrl = parsed.data.avatarUrl;

  const u = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: { id: true },
  });

  await audit("profile.update", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: session.user.id,
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json(u);
}
