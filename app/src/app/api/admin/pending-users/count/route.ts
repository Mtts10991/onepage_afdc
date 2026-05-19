import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Tiny endpoint used by the sidebar badge to surface "you have N people
 * waiting" without forcing the admin to visit the approval page. Cached
 * for 30s on the client so it doesn't hammer the DB on every nav.
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ count: 0 });
  }
  const count = await prisma.user.count({ where: { status: "PENDING" } });
  return NextResponse.json({ count });
}
