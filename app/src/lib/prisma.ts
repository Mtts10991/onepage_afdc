import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Cache the client on globalThis in EVERY environment — including production.
// In dev this prevents HMR from leaking new clients on each reload; in serverless
// (Vercel) it lets every module that does `import { prisma }` from the same
// invocation share one connection pool. The previous guard
// (`NODE_ENV !== "production"`) meant production callers got a fresh
// PrismaClient per import, which under pgbouncer transaction-pool can
// surface as "row inserted in one callback is invisible to the next" —
// exactly the symptom we hit with NextAuth's profile() → signIn() chain.
global.__prisma = prisma;
