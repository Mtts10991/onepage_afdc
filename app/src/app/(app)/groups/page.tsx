import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GroupsManager } from "@/components/groups/groups-manager";

export default async function GroupsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const [groups, users] = await Promise.all([
    prisma.group.findMany({
      orderBy: { name: "asc" },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                title: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        avatarUrl: true,
      },
    }),
  ]);

  // Serialise Dates so the client component receives a plain JSON tree.
  const groupsSerialized = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    members: g.members.map((m) => ({
      id: m.id,
      user: m.user,
    })),
  }));

  return <GroupsManager groups={groupsSerialized} allUsers={users} />;
}
