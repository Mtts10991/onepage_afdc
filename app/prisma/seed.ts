import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@admin.com";
  const password = process.env.ADMIN_PASSWORD ?? "afdc-gso@2026";
  const name = process.env.ADMIN_NAME ?? "System Administrator";

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "ADMIN",
      isActive: true,
      name,
    },
    create: {
      email,
      passwordHash,
      name,
      role: "ADMIN",
      isActive: true,
      title: "ผู้ดูแลระบบ",
    },
  });

  console.log("✓ admin seeded:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
