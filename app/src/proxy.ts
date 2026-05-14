// Next.js 16 — file นี้แทน middleware.ts (renamed to proxy.ts)
// runtime: nodejs (ค่า default ของ proxy)
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|fonts|uploads|favicon.ico).*)"],
};
