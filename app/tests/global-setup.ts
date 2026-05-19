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
  // Use the SQLite test schema (separate file because production
  // schema.prisma targets Postgres). Generate the test client into a
  // separate output path so it does not clobber the production client.
  const cwd = path.resolve(__dirname, "..");
  const env = { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` };
  execSync("pnpm prisma generate --schema=./prisma/schema.test.prisma", {
    cwd,
    stdio: "inherit",
    env,
  });
  execSync(
    "pnpm prisma db push --schema=./prisma/schema.test.prisma --skip-generate --accept-data-loss",
    { cwd, stdio: "inherit", env },
  );
}
