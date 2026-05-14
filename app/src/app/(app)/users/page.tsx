import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "@/components/users/users-manager";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

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

  // serialize date + narrow role string เป็น literal union
  const serialized = users.map((u) => ({
    ...u,
    role: (u.role === "ADMIN" ? "ADMIN" : "USER") as "ADMIN" | "USER",
    createdAt: u.createdAt.toISOString(),
  }));
  return <UsersManager initialUsers={serialized} />;
}
