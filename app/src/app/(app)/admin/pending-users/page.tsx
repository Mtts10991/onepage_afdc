import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { PendingUserRow } from "./_components/pending-user-row";

export const revalidate = 0;

export default async function PendingUsersPage() {
  const t = await getTranslations("admin");
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      registrationSource: true,
    },
  });

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-2xl font-semibold">{t("pendingUsersTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pendingUsersSubtitle", { count: users.length })}
        </p>
      </header>

      {users.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            {t("pendingUsersEmpty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <PendingUserRow
              key={u.id}
              id={u.id}
              email={u.email}
              name={u.name}
              avatarUrl={u.avatarUrl}
              // Pass ISO so the client can render both absolute + relative
              // time in the user's locale without a hydration mismatch.
              registeredAtIso={u.createdAt.toISOString()}
              registrationSource={u.registrationSource}
            />
          ))}
        </div>
      )}
    </div>
  );
}
