import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { passwordSchema } from "@/lib/password";
import { audit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { error: "unauth" as const, status: 401, session };
  if (session.user.role !== "ADMIN")
    return { error: "forbidden" as const, status: 403, session };
  return { session };
}

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      phone: true,
      role: true,
      isActive: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
  return NextResponse.json(users);
}

const createSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export async function POST(req: NextRequest) {
  const g = await requireAdmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const exists = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) return NextResponse.json({ error: "duplicate" }, { status: 409 });

  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      name: parsed.data.name,
      title: parsed.data.title,
      phone: parsed.data.phone,
      role: parsed.data.role,
    },
    select: { id: true, email: true },
  });
  await audit("user.create", {
    actorId: g.session?.user.id,
    actorEmail: g.session?.user.email,
    targetId: created.id,
    metadata: { email: created.email, role: parsed.data.role },
  });
  return NextResponse.json(created);
}
