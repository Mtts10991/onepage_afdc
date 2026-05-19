#!/usr/bin/env tsx
/**
 * One-off backfill: existing User rows predate the registrationSource
 * column. Set it to the most accurate value we can infer:
 *   - if a LINE Account row exists → "line"
 *   - else → "admin_created" (already the default, but write explicitly
 *     so a future column-default change doesn't silently shift values)
 *
 * Idempotent — re-running just no-ops on rows already at the right value.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      status: true,
      registrationSource: true,
      accounts: {
        where: { provider: "line" },
        select: { id: true },
        take: 1,
      },
    },
  });

  let updated = 0;
  for (const u of users) {
    // Inference rules (best effort — only used as one-time backfill):
    //  - has a linked LINE Account row → came in via LINE
    //  - is PENDING → must be a self-serve registration (admin-created
    //    users are minted ACTIVE; the only flow that leaves a row in
    //    PENDING is the LINE signup path)
    //  - otherwise → admin-created (default; safe assumption for the
    //    bootstrap admin and any historical seeded rows)
    const inferred =
      u.accounts.length > 0 || u.status === "PENDING"
        ? "line"
        : "admin_created";
    if (u.registrationSource === inferred) continue;
    await prisma.user.update({
      where: { id: u.id },
      data: { registrationSource: inferred },
    });
    console.log(`[${u.email}] ${u.registrationSource} → ${inferred}`);
    updated += 1;
  }
  console.log(`\nBackfilled ${updated} of ${users.length} users.`);
  await prisma.$disconnect();
}
main();
