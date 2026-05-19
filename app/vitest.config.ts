import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // SQLite test setup runs migrations sequentially via prisma — avoid
    // parallel suites racing on the same file.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: {
      // Redirect `@/lib/prisma` to a test-only client (SQLite). MUST appear
      // before the generic `@` alias because vitest matches in order.
      // All app code must import prisma as `@/lib/prisma` (not relative)
      // for this swap to take effect.
      "@/lib/prisma": path.resolve(__dirname, "./tests/prisma-shim.ts"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
