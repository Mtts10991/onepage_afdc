import { beforeEach } from "vitest";
import path from "node:path";

// `globalSetup` creates the SQLite test DB once per session; this per-file
// `setupFiles` only points the Prisma client at it and clears AuditLog
// between tests so suites don't see each other's seed data.
const TEST_DB_PATH = path.resolve(__dirname, "../prisma/test.db");
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.auditLog.deleteMany();
});
