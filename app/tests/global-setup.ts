import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";

const TEST_DB_PATH = path.resolve(__dirname, "../prisma/test.db");

// Vitest globalSetup runs ONCE per test session (not per file), so this is
// the only safe place to recreate the SQLite test DB without racing the
// open Prisma connection.
export default async function globalSetup() {
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // file may be locked by a prior crashed run; db push will overwrite
    }
  }
  process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
  execSync("pnpm prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
  });
}
