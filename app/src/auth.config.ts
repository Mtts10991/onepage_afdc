import type { NextAuthConfig } from "next-auth";
// Side-effect import — runs env validation once at boot. Kept here (rather
// than in auth.ts) so middleware/edge code paths also trigger the check.
import "@/lib/env";

/**
 * Edge-safe auth config (สำหรับ middleware)
 * Providers ที่ใช้ bcrypt/prisma ให้ใส่ใน auth.ts (non-edge)
 */
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    // Route ALL NextAuth errors back to /login instead of the default
    // /api/auth/error page. NextAuth appends `?error=<code>` (e.g.
    // AccessDenied, Configuration, Verification); the login form below
    // reads that param and renders a translated, user-facing message.
    // Without this, an unhandled exception in a callback dead-ends the
    // user on a bare JSON-ish error page.
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnPending = nextUrl.pathname.startsWith("/pending-approval");
      const status = (auth?.user as { status?: string } | undefined)?.status;
      const isPublic =
        nextUrl.pathname.startsWith("/api/auth") ||
        // LINE Messaging API webhook + Vercel/external cron — both
        // authenticate via their own signed/bearer schemes, NOT the
        // session cookie. They must be reachable unauthenticated.
        nextUrl.pathname.startsWith("/api/line/webhook") ||
        nextUrl.pathname.startsWith("/api/cron/") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/fonts") ||
        nextUrl.pathname.startsWith("/uploads") ||
        nextUrl.pathname === "/favicon.ico";

      if (isPublic) return true;
      if (isOnLogin) {
        if (isLoggedIn) {
          // PENDING users land on /pending-approval, not /dashboard —
          // they have a session but no permission to use the app yet.
          const dest = status === "PENDING" ? "/pending-approval" : "/dashboard";
          return Response.redirect(new URL(dest, nextUrl));
        }
        return true;
      }
      if (!isLoggedIn) return false;
      // Gate any route except /pending-approval itself for PENDING users.
      // The page lets them log out and shows their queue status.
      if (status === "PENDING" && !isOnPending) {
        return Response.redirect(new URL("/pending-approval", nextUrl));
      }
      // ACTIVE users shouldn't keep seeing the waiting room.
      if (status !== "PENDING" && isOnPending) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.status = (user as any).status ?? "ACTIVE";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).status = token.status as string;
      }
      return session;
    },
  },
  providers: [], // ใส่ใน auth.ts
};
