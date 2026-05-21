// Next.js 16 — this file replaces middleware.ts (renamed to proxy.ts).
// proxy runs in the Node.js runtime by default, so Prisma is available here.
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";

/**
 * The proxy (middleware) needs the SAME DB-backed jwt callback as auth.ts.
 *
 * Why: a LINE OAuth login does not reliably put our custom `id` field on
 * the object NextAuth hands the jwt callback, so `id`/`role`/`status` are
 * resolved from `token.email` against the DB. auth.ts already does this,
 * but the proxy was built from the bare `authConfig`, whose jwt callback
 * only seeds `if (user)` — never on a plain refresh. The result: right
 * after a LINE login the proxy saw a token with no `id`, `authorized()`
 * treated the request as logged-out, and bounced it back to /login even
 * though the login had succeeded.
 *
 * Running the same resolution here means the proxy and the route handlers
 * always agree on the session, so the post-login redirect lands on the
 * intended page instead of /login. Node runtime → Prisma is usable.
 */
export const { auth: proxy } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.status = (user as any).status ?? "ACTIVE";
      }
      const id = token.id as string | undefined;
      const email = token.email as string | undefined;
      if (id || email) {
        try {
          const row = await prisma.user.findUnique({
            where: id ? { id } : { email: email! },
            select: { id: true, role: true, status: true, isActive: true },
          });
          if (row && row.isActive) {
            token.id = row.id;
            token.role = row.role;
            token.status = row.status;
          } else {
            delete token.id;
            delete token.role;
            delete token.status;
          }
        } catch {
          // DB unreachable — keep the existing token rather than logging
          // the user out on a transient blip.
        }
      }
      return token;
    },
  },
});

export default proxy;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|fonts|uploads|favicon.ico).*)"],
};
