import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";
import { LineSetup } from "@/components/profile/line-setup";

const LINE_ENABLED = Boolean(process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET);
// Public deep-link to the LINE Official Account, e.g.
// https://line.me/R/ti/p/@012abcde — published once the OA is
// provisioned. Empty string disables the "Add friend" CTA gracefully.
const LINE_OA_ADD_URL = process.env.LINE_OA_ADD_URL ?? "";

export default async function ProfilePage() {
  const session = await auth();
  const [u, lineLink] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        phone: true,
        avatarUrl: true,
        role: true,
        lineBotUserId: true,
      },
    }),
    prisma.account.findFirst({
      where: { userId: session!.user.id, provider: "line" },
      select: { providerAccountId: true },
    }),
  ]);
  if (!u) return null;
  return (
    <div className="space-y-6">
      <ProfileForm user={u} />
      {LINE_ENABLED && (
        <LineSetup
          accountLinked={Boolean(lineLink)}
          notifyEnabled={Boolean(u.lineBotUserId)}
          email={u.email}
          addFriendUrl={LINE_OA_ADD_URL}
        />
      )}
    </div>
  );
}
