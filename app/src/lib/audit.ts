import { headers } from "next/headers";
import { prisma } from "./prisma";

/**
 * Append a row to the audit trail.
 *
 * - Never throws — audit failure should never break the request it audits.
 *   We log to console in dev and silently swallow in production.
 * - `metadata` is `JSON.stringify`'d so call sites can pass plain objects.
 * - Reads the client IP + user-agent from `next/headers`; if called outside
 *   a request scope, those fields are left null.
 *
 * Usage:
 *   await audit("user.delete", {
 *     actorId: session.user.id,
 *     actorEmail: session.user.email,
 *     targetId: deletedUser.id,
 *     metadata: { email: deletedUser.email },
 *   });
 */
export interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function audit(event: string, input: AuditInput = {}) {
  try {
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      userAgent = h.get("user-agent");
    } catch {
      // headers() only works inside a request scope; ignore otherwise.
    }

    await prisma.auditLog.create({
      data: {
        event,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[audit] failed to record event", event, err);
    }
  }
}
