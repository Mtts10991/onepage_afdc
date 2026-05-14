import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { canAccessOnePage } from "@/lib/onepage-access";
import { onepageDataSchema } from "@/lib/onepage-schema";

/** See onepages/route.ts for rationale on the size cap. */
const MAX_DATA_JSON_BYTES = 2 * 1024 * 1024;

/**
 * Resolve a OnePage by id + decide whether the caller has access.
 * Returns the row + decision so handlers don't refetch.
 */
async function resolveAccess(id: string) {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };
  const onepage = await prisma.onePage.findUnique({ where: { id } });
  if (!onepage) return { error: "notfound" as const, status: 404, session };
  const decision = await canAccessOnePage(session.user, onepage.ownerId);
  if (!decision.ok) {
    return { error: "forbidden" as const, status: 403, session };
  }
  return { onepage, session, decision };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolveAccess(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.onepage);
}

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  data: onepageDataSchema,
  // Cap revision-note to one tweet-length so accidental log-paste doesn't
  // bloat the version table; UI shows a single line anyway.
  note: z.string().max(280).optional(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolveAccess(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.decision.canEdit) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const dataJson = JSON.stringify(parsed.data.data);
  if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_JSON_BYTES) {
    return NextResponse.json({ error: "data_too_large" }, { status: 400 });
  }

  const editorId = r.session!.user.id;
  const isCrossOwner = r.decision.isCrossOwner;

  // Prefix cross-owner edits in the version note so reviewers can spot them
  // in the version history without expanding metadata.
  const versionNote = parsed.data.note
    ? isCrossOwner
      ? `[group-edit by ${r.session!.user.email ?? editorId}] ${parsed.data.note}`
      : parsed.data.note
    : isCrossOwner
      ? `[group-edit by ${r.session!.user.email ?? editorId}]`
      : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const op = await tx.onePage.update({
      where: { id },
      data: {
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        data: dataJson,
        lastEditedById: editorId,
        lastEditedAt: new Date(),
      },
    });
    await tx.onePageVersion.create({
      data: {
        onepageId: id,
        authorId: editorId,
        data: dataJson,
        note: versionNote,
      },
    });
    return op;
  });

  await audit("onepage.update", {
    actorId: editorId,
    actorEmail: r.session?.user.email,
    targetId: id,
    metadata: {
      titleChanged: Boolean(parsed.data.title),
      hasNote: Boolean(parsed.data.note),
      // Critical accountability signal — flag every edit that wasn't done
      // by the row's owner so we can filter for them later.
      crossOwner: isCrossOwner,
      ownerId: r.onepage!.ownerId,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolveAccess(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  // Group teammates can edit but NOT delete; that stays with owner / admin.
  if (!r.decision.canDelete) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.onePage.delete({ where: { id } });

  await audit("onepage.delete", {
    actorId: r.session?.user.id,
    actorEmail: r.session?.user.email,
    targetId: id,
    metadata: { title: r.onepage?.title, ownerId: r.onepage?.ownerId },
  });

  return NextResponse.json({ ok: true });
}
