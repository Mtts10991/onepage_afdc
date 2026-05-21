import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { onepageDataSchema, onepageTypeSchema } from "@/lib/onepage-schema";

/**
 * Templates — reusable starting points for a new OnePage.
 *
 * Visibility rules:
 *  - `isSystem` templates are visible to everyone, editable only by ADMIN.
 *  - personal templates are scoped to their `ownerId`.
 * The GET endpoint enforces both in a single query.
 *
 * `data` is stored as a JSON string matching `onepageDataSchema`. Same size
 * cap as OnePage (2 MB) so a malicious client can't bloat the DB with a
 * single oversized template.
 */
const MAX_DATA_JSON_BYTES = 2 * 1024 * 1024;

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  data: onepageDataSchema,
  isSystem: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json([], { status: 401 });

  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const typeFilter = typeParam
    ? onepageTypeSchema.safeParse(typeParam).data
    : undefined;

  // Visibility rule (matches /onepages list + /templates page):
  //   - regular user → their own templates + every system template
  //   - admin        → everything
  const isAdmin = session.user.role === "ADMIN";
  const visibility: Prisma.TemplateWhereInput = isAdmin
    ? {}
    : { OR: [{ ownerId: session.user.id }, { isSystem: true }] };

  const where: Prisma.TemplateWhereInput = {
    AND: [visibility, typeFilter ? { type: typeFilter } : {}],
  };

  const list = await prisma.template.findMany({
    where,
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      ownerId: true,
    },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // `session.user.id` can be absent when the jwt callback blanked a stale
  // token (an id that no longer resolves to a User row). Treat that as
  // unauthenticated rather than passing `undefined` into a foreign-key
  // insert, which would surface as an opaque 500.
  if (!session?.user?.id)
    return NextResponse.json({ error: "unauth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Only admins may create system templates; otherwise force the flag off
  // so a regular user can't silently publish to everyone.
  const isSystem =
    parsed.data.isSystem === true && session.user.role === "ADMIN";

  const dataJson = JSON.stringify(parsed.data.data);
  if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_JSON_BYTES) {
    return NextResponse.json({ error: "data_too_large" }, { status: 400 });
  }

  const created = await prisma.template.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.data.type,
      data: dataJson,
      isSystem,
      // System templates aren't tied to a single user — leaving owner null
      // means the row survives when the creating admin is later deleted.
      ownerId: isSystem ? null : session.user.id,
    },
    select: { id: true, name: true, type: true, isSystem: true },
  });

  await audit("template.create", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    targetId: created.id,
    metadata: { name: created.name, type: created.type, isSystem },
  });

  return NextResponse.json(created);
}
