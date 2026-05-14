/**
 * Startup-time environment validation.
 *
 * Imported once from a module that always loads at server start
 * (auth.config / instrumentation). The intent is to fail loudly during
 * deployment if a critical variable is missing or unsafe, instead of
 * silently using a placeholder and pretending things are fine.
 *
 * Skipped during `next build` (NEXT_PHASE === "phase-production-build") —
 * during build the server isn't actually serving anything yet, and CI
 * environments routinely lack a real NEXTAUTH_URL. We re-check at boot,
 * which is what actually matters.
 */

const PROD = process.env.NODE_ENV === "production";
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

function fail(msg: string): never {
  if (PROD) {
    // Hard-fail in production so a misconfigured deploy never starts.
    throw new Error(`[env] ${msg}`);
  }
  // In dev, surface it loudly but keep going so localhost remains usable.
  console.error(`[env] ${msg}`);
  return undefined as never;
}

function check() {
  // During `next build` the bundler imports server modules to harvest page
  // metadata — the real runtime env isn't available yet. Skip the strict
  // checks here; we re-run at first boot via the same module import.
  if (IS_BUILD) return;

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    fail("AUTH_SECRET is missing or shorter than 32 chars — generate with `openssl rand -base64 32`.");
  }
  if (secret && /placeholder|change|example|replace/i.test(secret)) {
    fail("AUTH_SECRET looks like a placeholder value. Generate a real one.");
  }

  const url = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  if (PROD) {
    if (!url) {
      fail("NEXTAUTH_URL must be set in production.");
    } else if (!url.startsWith("https://")) {
      fail(`NEXTAUTH_URL must use HTTPS in production (got: ${url}).`);
    }
  }

  if (PROD && /change_me|change-me|admin@admin/i.test(process.env.ADMIN_PASSWORD ?? "")) {
    fail("ADMIN_PASSWORD looks like a default — rotate it before going to production.");
  }
}

// Run on module load. Safe to import multiple times — Node caches modules.
check();
