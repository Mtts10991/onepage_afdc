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
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isPublic =
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.startsWith("/fonts") ||
        nextUrl.pathname.startsWith("/uploads") ||
        nextUrl.pathname === "/favicon.ico";

      if (isPublic) return true;
      if (isOnLogin) {
        if (isLoggedIn)
          return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // ใส่ใน auth.ts
};
