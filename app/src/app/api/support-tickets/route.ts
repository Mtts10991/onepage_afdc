import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { audit } from "@/lib/audit";

/**
 * Admin-only endpoint that records a help-desk ticket as an AuditLog row
 * with `event = "support.ticket.recorded"`. We deliberately avoid a
 * dedicated `Ticket` Prisma model for milestone 1 — the AuditLog table is
 * the single source of truth for baseline metrics and ticket volume is
 * small enough (admin-typed, < 50/week) that a separate table adds
 * migration churn without buying anything. Promote to its own model in
 * milestone 6 if ticket lifecycle (status transitions, assignment) is
 * needed.
 */
const SUPPORT_TICKET_CATEGORIES = [
  "login",
  "format",
  "export",
  "mobile",
  "other",
] as const;

const schema = z.object({
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  summary: z.string().min(1).max(500),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await audit("support.ticket.recorded", {
    actorId: session.user.id,
    actorEmail: session.user.email,
    metadata: {
      category: parsed.data.category,
      summary: parsed.data.summary,
      occurredAt: parsed.data.occurredAt ?? new Date().toISOString(),
      source: "manual",
    },
  });

  return NextResponse.json({ ok: true });
}
