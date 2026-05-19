// Test-only Prisma Client shim. Vitest aliases `@/lib/prisma` to this
// module so tests use the SQLite client generated from
// `prisma/schema.test.prisma` (output path `.prisma/client-test`)
// instead of the production Postgres client. Same export name + shape
// as `src/lib/prisma.ts` — only the underlying client differs.

import { PrismaClient } from "../node_modules/.prisma/client-test/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __prismaTest: PrismaClient | undefined;
}

export const prisma =
  global.__prismaTest ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prismaTest = prisma;
}
