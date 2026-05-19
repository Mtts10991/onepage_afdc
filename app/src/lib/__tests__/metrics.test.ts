import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  avgTimeToComplete,
  formErrorRate,
  loginAdoptionByProvider,
  windowFromDays,
} from "@/lib/metrics";

const ACTOR = "user-1";
const TARGET = "onepage-1";

async function seedAuditLog(
  event: string,
  createdAt: Date,
  metadata?: Record<string, unknown>,
  targetId: string = TARGET,
) {
  await prisma.auditLog.create({
    data: {
      event,
      actorId: ACTOR,
      actorEmail: "user@example.com",
      targetId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt,
    },
  });
}

describe("formErrorRate", () => {
  it("counts validation failures plus fix-up updates over (creates + updates)", async () => {
    const now = new Date();
    // 1 create
    await seedAuditLog("onepage.create", new Date(now.getTime() - 9_000));
    // 5 updates — 2 of them are fix-ups (within 5 min of prior update)
    await seedAuditLog("onepage.update", new Date(now.getTime() - 8_000), {
      secondsSinceLastUpdate: 1000,
    });
    await seedAuditLog("onepage.update", new Date(now.getTime() - 7_000), {
      secondsSinceLastUpdate: 60, // fix-up
    });
    await seedAuditLog("onepage.update", new Date(now.getTime() - 6_000), {
      secondsSinceLastUpdate: 5000,
    });
    await seedAuditLog("onepage.update", new Date(now.getTime() - 5_000), {
      secondsSinceLastUpdate: 120, // fix-up
    });
    await seedAuditLog("onepage.update", new Date(now.getTime() - 4_000), {
      secondsSinceLastUpdate: 9000,
    });
    // 2 validation failures
    await seedAuditLog("onepage.validation.failure", new Date(now.getTime() - 3_000), {
      route: "PUT /api/onepages/[id]",
      fieldPaths: ["data"],
    });
    await seedAuditLog("onepage.validation.failure", new Date(now.getTime() - 2_000), {
      route: "POST /api/onepages",
      fieldPaths: ["title"],
    });

    const result = await formErrorRate(windowFromDays(1));
    // denominator = 1 create + 5 updates = 6
    // numerator   = 2 validation failures + 2 fix-ups = 4
    expect(result.denominator).toBe(6);
    expect(result.numerator).toBe(4);
    expect(result.validationFailures).toBe(2);
    expect(result.fixups).toBe(2);
    expect(result.rate).toBeCloseTo(4 / 6, 5);
  });
});

describe("loginAdoptionByProvider", () => {
  it("splits successes by metadata.provider, defaulting legacy rows to credentials", async () => {
    const now = new Date();
    // 2 LINE logins
    await seedAuditLog("auth.login.success", new Date(now.getTime() - 9_000), {
      provider: "line",
    });
    await seedAuditLog("auth.login.success", new Date(now.getTime() - 8_000), {
      provider: "line",
    });
    // 3 credentials logins
    await seedAuditLog("auth.login.success", new Date(now.getTime() - 7_000), {
      provider: "credentials",
    });
    await seedAuditLog("auth.login.success", new Date(now.getTime() - 6_000), {
      provider: "credentials",
    });
    // 1 legacy row (no metadata) — should bucket as credentials
    await seedAuditLog("auth.login.success", new Date(now.getTime() - 5_000));

    const result = await loginAdoptionByProvider(windowFromDays(1));
    expect(result.total).toBe(5);
    expect(result.line).toBe(2);
    expect(result.credentials).toBe(3);
    expect(result.linePercent).toBeCloseTo(2 / 5, 5);
    expect(result.pending).toBe(false);
  });
});

describe("avgTimeToComplete", () => {
  it("pairs first edit.started with publish on the same target and returns seconds", async () => {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 12 * 60 * 1000); // 12 min ago
    const publishedAt = new Date(now.getTime() - 0); // now
    await seedAuditLog("onepage.edit.started", startedAt, { mode: "edit", type: "report" });
    // a second start that should be ignored (de-duped)
    await seedAuditLog("onepage.edit.started", new Date(now.getTime() - 6 * 60 * 1000), {
      mode: "edit",
      type: "report",
    });
    await seedAuditLog("onepage.publish", publishedAt, { firstFormat: "pptx" });

    const result = await avgTimeToComplete(windowFromDays(1));
    expect(result.count).toBe(1);
    expect(result.p50).toBeGreaterThan(700);
    expect(result.p50).toBeLessThan(740);
  });
});
