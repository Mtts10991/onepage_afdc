import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";
import { notifyOnePageCrossEdited } from "@/lib/notify";
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
  /**
   * Optimistic-concurrency token. Client sends back the `updatedAt` it
   * received on its initial fetch; if the row has moved on (someone else
   * — or the same user on another tab — saved in the meantime) we 409
   * instead of overwriting. Optional for backwards compatibility with
   * the existing manual-save flow that doesn't yet send it.
   */
  expectedUpdatedAt: z.string().datetime().optional(),
  /**
   * Marks the request as a debounced autosave (vs. an explicit Save
   * click). Affects version-table policy: consecutive autosaves within
   * a short window collapse into a single version row to keep the
   * history list legible.
   */
  isAutosave: z.boolean().optional(),
});

/** Coalesce window: an autosave that lands within this many seconds of
 * the most recent version row updates that row in place instead of
 * spawning a new one. Stops a fast typist from generating dozens of
 * near-identical rows in OnePageVersion. */
const AUTOSAVE_VERSION_COALESCE_SECONDS = 5 * 60;

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await resolveAccess(id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (!r.decision.canEdit) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    await audit("onepage.validation.failure", {
      actorId: r.session?.user.id,
      actorEmail: r.session?.user.email,
      targetId: id,
      metadata: {
        route: "PUT /api/onepages/[id]",
        fieldPaths: Object.keys(parsed.error.flatten().fieldErrors),
      },
    });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dataJson = JSON.stringify(parsed.data.data);
  if (Buffer.byteLength(dataJson, "utf8") > MAX_DATA_JSON_BYTES) {
    await audit("onepage.validation.failure", {
      actorId: r.session?.user.id,
      actorEmail: r.session?.user.email,
      targetId: id,
      metadata: {
        route: "PUT /api/onepages/[id]",
        fieldPaths: ["data"],
        reason: "data_too_large",
        bytes: Buffer.byteLength(dataJson, "utf8"),
      },
    });
    return NextResponse.json({ error: "data_too_large" }, { status: 400 });
  }

  const editorId = r.session!.user.id;
  const isCrossOwner = r.decision.isCrossOwner;
  const isAutosave = parsed.data.isAutosave === true;

  // Optimistic concurrency. We only check when the client provides the
  // token — older clients (and the M2 manual save flow before it adopts
  // expectedUpdatedAt) keep working with last-write-wins semantics.
  if (parsed.data.expectedUpdatedAt) {
    const expected = new Date(parsed.data.expectedUpdatedAt).getTime();
    const actual = r.onepage!.updatedAt.getTime();
    if (expected !== actual) {
      await audit("onepage.autosave.conflict", {
        actorId: editorId,
        actorEmail: r.session?.user.email,
        targetId: id,
        metadata: {
          expectedUpdatedAt: parsed.data.expectedUpdatedAt,
          actualUpdatedAt: r.onepage!.updatedAt.toISOString(),
          isAutosave,
        },
      });
      return NextResponse.json(
        {
          error: "conflict",
          serverUpdatedAt: r.onepage!.updatedAt.toISOString(),
        },
        { status: 409 },
      );
    }
  }

  // Fix-up detection: how long since the previous edit on this row.
  // If the same user re-edits within a short window we treat it as a
  // correction of a prior mistake — feeds the "form error rate" metric.
  const previousEditedAt = r.onepage!.lastEditedAt ?? r.onepage!.createdAt;
  const secondsSinceLastUpdate = Math.max(
    0,
    Math.floor((Date.now() - previousEditedAt.getTime()) / 1000),
  );

  // Prefix cross-owner edits in the version note so reviewers can spot
  // them in the version history without expanding metadata. Autosaves
  // get a leading "[autosave]" tag so the history UI can filter them
  // distinctly from explicit saves without a schema change.
  const tags: string[] = [];
  if (isAutosave) tags.push("[autosave]");
  if (isCrossOwner) tags.push(`[group-edit by ${r.session!.user.email ?? editorId}]`);
  const prefix = tags.join(" ");
  const versionNote = parsed.data.note
    ? prefix
      ? `${prefix} ${parsed.data.note}`
      : parsed.data.note
    : prefix || undefined;

  // Coalesce consecutive autosaves into a single version row. Without
  // this, a 2.5s autosave debounce + a 10-minute editing session would
  // create ~200 rows that all look identical in the history view.
  let recentAutosave: { id: string; createdAt: Date } | null = null;
  if (isAutosave) {
    recentAutosave = await prisma.onePageVersion.findFirst({
      where: {
        onepageId: id,
        authorId: editorId,
        note: { startsWith: "[autosave]" },
        createdAt: {
          gte: new Date(Date.now() - AUTOSAVE_VERSION_COALESCE_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    });
  }

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
    if (recentAutosave) {
      await tx.onePageVersion.update({
        where: { id: recentAutosave.id },
        data: { data: dataJson, note: versionNote },
      });
    } else {
      await tx.onePageVersion.create({
        data: {
          onepageId: id,
          authorId: editorId,
          data: dataJson,
          note: versionNote,
        },
      });
    }
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
      secondsSinceLastUpdate,
      bytes: Buffer.byteLength(dataJson, "utf8"),
      isAutosave,
      coalescedIntoVersion: recentAutosave?.id ?? null,
    },
  });

  // Skip cross-owner notification for autosaves — pushing the owner
  // every 2.5s while a teammate types would be unbearable. The next
  // explicit Save (or first export) will still trigger the notify path.
  if (isCrossOwner && !isAutosave) {
    await notifyOnePageCrossEdited(id, editorId, r.session?.user.email ?? null);
  }

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
