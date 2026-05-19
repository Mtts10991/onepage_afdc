import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    await audit("profile.validation.failure", {
      actorId: session.user.id,
      actorEmail: session.user.email,
      metadata: {
        route: "POST /api/profile/password",
        fieldPaths: Object.keys(parsed.error.flatten().fieldErrors),
      },
    });
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const u = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!u) return NextResponse.json({ error: "notfound" }, { status: 404 });
  const ok = await bcrypt.compare(parsed.data.currentPassword, u.passwordHash);
  if (!ok) return NextResponse.json({ error: "invalid_password" }, { status: 400 });

  // Reject re-using the same password — small but meaningful guardrail.
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return NextResponse.json({ error: "same_password" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: u.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });

  await audit("profile.password_change", {
    actorId: u.id,
    actorEmail: u.email,
    targetId: u.id,
  });

  return NextResponse.json({ ok: true });
}
