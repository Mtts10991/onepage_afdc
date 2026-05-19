import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notifyOnePageDeadlineDue } from "@/lib/notify";

/**
 * Hourly cron route invoked by Vercel Cron (or any external scheduler).
 *
 * Authentication: Vercel Cron always sends `Authorization: Bearer
 * $CRON_SECRET`. External cron jobs can use the same secret. We refuse
 * the request unless the header matches — without this an attacker
 * could spam every owner by hammering this endpoint.
 *
 * Window: we fire on each onepage with a plan-type deadline that falls
 * 0–24 hours from now, AND has no `line.notify.success` row in the past
 * 23 hours (dedupe so re-runs within the same hour don't double-push).
 *
 * Scope: plan-type only — report-type onepages don't carry a deadline
 * in the schema, so they can't be selected here.
 */

export const dynamic = "force-dynamic";

interface RunOnePage {
  id: string;
  data: string;
}

interface PlanWithDeadline {
  type: "plan";
  deadline?: string | null;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "no_secret_configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const now = Date.now();
  const horizon = new Date(now + 24 * 60 * 60 * 1000);
  const dedupeSince = new Date(now - 23 * 60 * 60 * 1000);

  // SQLite has no JSON operators we can lean on without raw SQL, so we
  // fetch all candidate rows (those updated recently — plans being
  // actively planned) and filter in TS. Acceptable at pilot scale.
  // Filter: only rows that look like plans (cheap LIKE on the JSON
  // string keeps the scan small).
  const candidates: RunOnePage[] = await prisma.onePage.findMany({
    where: { data: { contains: '"type":"plan"' } },
    select: { id: true, data: true },
  });

  let considered = 0;
  let pushed = 0;
  let skipped = 0;

  for (const row of candidates) {
    let parsedData: PlanWithDeadline | null = null;
    try {
      parsedData = JSON.parse(row.data) as PlanWithDeadline;
    } catch {
      continue;
    }
    if (parsedData.type !== "plan" || !parsedData.deadline) continue;
    const deadlineTs = Date.parse(parsedData.deadline);
    if (!Number.isFinite(deadlineTs)) continue;
    if (deadlineTs <= now) continue; // past — out of window
    if (deadlineTs > horizon.getTime()) continue; // > 24h out — out of window
    considered += 1;

    // Dedupe: did we already fire a deadline_24h push for this onepage
    // in the past 23 hours?
    const recent = await prisma.auditLog.findFirst({
      where: {
        event: "line.notify.success",
        targetId: row.id,
        createdAt: { gte: dedupeSince },
        metadata: { contains: '"reason":"deadline_24h"' },
      },
      select: { id: true },
    });
    if (recent) {
      skipped += 1;
      continue;
    }

    await notifyOnePageDeadlineDue(row.id);
    pushed += 1;
  }

  await audit("line.cron.notify_deadlines.run", {
    metadata: { considered, pushed, skipped, candidates: candidates.length },
  });

  return NextResponse.json({ ok: true, considered, pushed, skipped });
}
