import { prisma } from "@/lib/prisma";
import { parseUA } from "@/lib/user-agent";

/**
 * Query layer for the admin metrics dashboard. Reads exclusively from
 * `AuditLog` — no other tables — so the dashboard stays decoupled from
 * application schema evolution. Each function takes a time window and
 * returns plain numbers/series the page can render without further
 * processing.
 *
 * SQLite has no `DATE_TRUNC`, so daily-bucket helpers fetch rows and
 * bucket in TypeScript. At the expected pilot volume (< 100k rows in two
 * weeks) this is fine and avoids raw-SQL coupling.
 */

export interface Window {
  from: Date;
  to: Date;
}

export function windowFromDays(days: number, anchor: Date = new Date()): Window {
  const to = anchor;
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

/**
 * Form error rate = (validation failures + fix-up updates) / (creates + updates).
 * A "fix-up update" is an `onepage.update` that arrived within FIXUP_SECONDS
 * of the previous update on the same target — strong proxy for a user
 * correcting an earlier mistake.
 */
const FIXUP_SECONDS = 300;

export async function formErrorRate(w: Window) {
  const [validationFailures, updates, creates] = await Promise.all([
    prisma.auditLog.count({
      where: {
        event: { contains: ".validation.failure" },
        createdAt: { gte: w.from, lte: w.to },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        event: "onepage.update",
        createdAt: { gte: w.from, lte: w.to },
      },
      select: { metadata: true },
    }),
    prisma.auditLog.count({
      where: {
        event: "onepage.create",
        createdAt: { gte: w.from, lte: w.to },
      },
    }),
  ]);

  let fixups = 0;
  for (const row of updates) {
    if (!row.metadata) continue;
    try {
      const meta = JSON.parse(row.metadata) as { secondsSinceLastUpdate?: number };
      if (
        typeof meta.secondsSinceLastUpdate === "number" &&
        meta.secondsSinceLastUpdate <= FIXUP_SECONDS
      ) {
        fixups += 1;
      }
    } catch {
      // ignore malformed legacy metadata
    }
  }

  const denominator = creates + updates.length;
  const numerator = validationFailures + fixups;
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? 0 : numerator / denominator,
    validationFailures,
    fixups,
  };
}

/**
 * Time-to-complete: pair the FIRST `onepage.edit.started` per (actor,
 * target) with the matching `onepage.publish` and report p50/p90 in
 * seconds. De-duping on first start avoids the bias of repeated mounts.
 */
export async function avgTimeToComplete(w: Window) {
  const [starts, publishes] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        event: "onepage.edit.started",
        createdAt: { gte: w.from, lte: w.to },
      },
      select: { actorId: true, targetId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: {
        event: "onepage.publish",
        createdAt: { gte: w.from, lte: w.to },
      },
      select: { actorId: true, targetId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const firstStart = new Map<string, Date>(); // key = `${actorId}|${targetId}`
  for (const s of starts) {
    const k = `${s.actorId ?? ""}|${s.targetId ?? ""}`;
    if (!firstStart.has(k)) firstStart.set(k, s.createdAt);
  }

  const deltas: number[] = [];
  for (const p of publishes) {
    if (!p.targetId) continue;
    // Match on target only — the publish may have been emitted by a
    // different actor (group edit), and we still want to attribute it to
    // the original start. If multiple actors started, take the earliest.
    let earliest: Date | undefined;
    for (const [k, ts] of firstStart) {
      if (k.endsWith(`|${p.targetId}`)) {
        if (!earliest || ts < earliest) earliest = ts;
      }
    }
    if (earliest && p.createdAt > earliest) {
      deltas.push((p.createdAt.getTime() - earliest.getTime()) / 1000);
    }
  }

  deltas.sort((a, b) => a - b);
  const p50 = percentile(deltas, 50);
  const p90 = percentile(deltas, 90);
  return { count: deltas.length, p50, p90 };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export async function supportTicketCount(w: Window) {
  const rows = await prisma.auditLog.findMany({
    where: {
      event: "support.ticket.recorded",
      createdAt: { gte: w.from, lte: w.to },
    },
    select: { metadata: true },
  });
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    if (!r.metadata) continue;
    try {
      const meta = JSON.parse(r.metadata) as { category?: string };
      const c = meta.category ?? "other";
      byCategory[c] = (byCategory[c] ?? 0) + 1;
    } catch {
      // ignore
    }
  }
  return { total: rows.length, byCategory };
}

export async function exportFailureRate(w: Window) {
  const [succ, fail] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        event: "onepage.export.success",
        createdAt: { gte: w.from, lte: w.to },
      },
      select: { metadata: true },
    }),
    prisma.auditLog.findMany({
      where: {
        event: "onepage.export.failure",
        createdAt: { gte: w.from, lte: w.to },
      },
      select: { metadata: true },
    }),
  ]);
  const bucket = (rows: typeof succ) => {
    const out = { pptx: 0, png: 0 };
    for (const r of rows) {
      if (!r.metadata) continue;
      try {
        const meta = JSON.parse(r.metadata) as { format?: string };
        if (meta.format === "pptx") out.pptx += 1;
        else if (meta.format === "png") out.png += 1;
      } catch {
        // ignore
      }
    }
    return out;
  };
  const successes = bucket(succ);
  const failures = bucket(fail);
  const totalSuccess = succ.length;
  const totalFailure = fail.length;
  const total = totalSuccess + totalFailure;
  return {
    successes,
    failures,
    failureRate: total === 0 ? 0 : totalFailure / total,
    total,
  };
}

/**
 * Mobile completion rate: of the actors who created/edited from a mobile
 * UA in the window, how many had at least one `onepage.publish`?
 * Sessions are coarse-bucketed by (actor, day) — accurate enough for the
 * 2-week baseline and avoids per-tab session-id plumbing.
 */
export async function mobileCompletionRate(w: Window) {
  const rows = await prisma.auditLog.findMany({
    where: {
      event: { in: ["onepage.edit.started", "onepage.publish"] },
      createdAt: { gte: w.from, lte: w.to },
    },
    select: { event: true, actorId: true, userAgent: true, createdAt: true },
  });

  const mobileSessions = new Set<string>();
  const completedSessions = new Set<string>();
  for (const r of rows) {
    if (!r.actorId) continue;
    const ua = parseUA(r.userAgent);
    if (!ua.isMobile) continue;
    const day = r.createdAt.toISOString().slice(0, 10);
    const key = `${r.actorId}|${day}`;
    mobileSessions.add(key);
    if (r.event === "onepage.publish") completedSessions.add(key);
  }
  return {
    sessions: mobileSessions.size,
    completed: completedSessions.size,
    rate: mobileSessions.size === 0 ? 0 : completedSessions.size / mobileSessions.size,
  };
}

/**
 * Login adoption broken down by provider. Reads `metadata.provider` on
 * `auth.login.success` rows (added in M2 — older rows without it count
 * as "credentials" since that was the only path available pre-M2).
 */
export async function loginAdoptionByProvider(w: Window) {
  const rows = await prisma.auditLog.findMany({
    where: {
      event: "auth.login.success",
      createdAt: { gte: w.from, lte: w.to },
    },
    select: { metadata: true },
  });
  let credentials = 0;
  let line = 0;
  for (const r of rows) {
    let provider: string | undefined;
    if (r.metadata) {
      try {
        provider = (JSON.parse(r.metadata) as { provider?: string }).provider;
      } catch {
        // ignore malformed
      }
    }
    if (provider === "line") line += 1;
    else credentials += 1; // unknown/missing → assume legacy credentials
  }
  const total = credentials + line;
  return {
    total,
    credentials,
    line,
    linePercent: total === 0 ? 0 : line / total,
    pending: false,
  };
}

/**
 * LINE Notify opt-in measures the share of active users that have added
 * the Official Account as a friend (and therefore have a non-null
 * `lineBotUserId`). Only active users count as the denominator so a
 * stale ex-employee directory doesn't drag the rate down forever.
 */
export async function lineNotifyOptIn() {
  const [optedIn, total] = await Promise.all([
    prisma.user.count({
      where: { isActive: true, lineBotUserId: { not: null } },
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);
  return {
    optedIn,
    total,
    percent: total === 0 ? 0 : optedIn / total,
    pending: false,
  };
}

export async function dailySeries(
  event: string,
  w: Window,
): Promise<Array<{ day: string; count: number }>> {
  const rows = await prisma.auditLog.findMany({
    where: { event, createdAt: { gte: w.from, lte: w.to } },
    select: { createdAt: true },
  });
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  // Fill missing days with zero for clean sparklines.
  const out: Array<{ day: string; count: number }> = [];
  const cursor = new Date(w.from.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(w.to.getTime());
  end.setUTCHours(0, 0, 0, 0);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    out.push({ day, count: buckets.get(day) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}
