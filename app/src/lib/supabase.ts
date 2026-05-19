import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase admin client (uses service_role key, bypasses RLS).
 *
 * Why a singleton: Next.js can hot-reload modules in dev which would otherwise
 * spawn a new HTTP client + connection pool on every request. The global cache
 * mirrors the pattern used in `lib/prisma.ts`.
 *
 * NEVER import this from a Client Component. The service role key has full
 * database access; leaking it to the browser would let any visitor bypass RLS
 * and read/write every row.
 */

declare global {
  // eslint-disable-next-line no-var
  var __supabaseAdmin: SupabaseClient | undefined;
}

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && serviceRoleKey
    ? global.__supabaseAdmin ??
      createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

if (process.env.NODE_ENV !== "production" && supabaseAdmin) {
  global.__supabaseAdmin = supabaseAdmin;
}

export const SUPABASE_STORAGE_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

/**
 * True when Supabase Storage is configured. Routes should fall back to local
 * filesystem only when this returns false (dev convenience).
 */
export function isSupabaseStorageEnabled(): boolean {
  return supabaseAdmin !== null;
}
