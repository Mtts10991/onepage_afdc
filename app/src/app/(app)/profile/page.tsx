import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const session = await auth();
  const u = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      title: true,
      phone: true,
      avatarUrl: true,
      role: true,
    },
  });
  if (!u) return null;
  return <ProfileForm user={u} />;
}
