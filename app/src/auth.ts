import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clearRate } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { authConfig } from "./auth.config";

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Pre-computed bcrypt hash used when the email isn't found in the database.
 * Comparing against a real hash equalises authorize() timing so an attacker
 * can't distinguish "user does not exist" from "wrong password" via the
 * response-time side channel (OWASP A07 / CWE-203).
 *
 * The plaintext is unknown — `bcrypt.compare` will always return false here.
 */
const DUMMY_HASH =
  "$2a$10$.F8U9FusAoPHtKe5efZ9s.6/jXwX/sYDaDYSlx4vIqTWdgiT44Vi2";

const isDev = process.env.NODE_ENV === "development";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credSchema.safeParse(credentials);
        if (!parsed.success) {
          if (isDev) console.warn("[auth] schema invalid");
          return null;
        }
        const { email, password } = parsed.data;

        // Per-email throttle: 5 failed attempts per 15 minutes.
        // Keyed by lowercase email so case variations don't reset the bucket.
        // (Per-IP throttling needs request headers, which `authorize` doesn't
        // receive directly in NextAuth v5 — for now this is a defence-in-depth
        // layer on top of NextAuth's built-in CSRF protection.)
        const rateKey = `login:${email.toLowerCase()}`;
        const rl = rateLimit(rateKey, 5, 15 * 60_000);
        if (!rl.ok) {
          if (isDev) console.warn("[auth] rate-limited");
          await audit("auth.login.rate_limited", { actorEmail: email });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Always run bcrypt.compare — even when the user is missing or
        // inactive — so failure timing is constant.
        const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
        const passwordOk = await bcrypt.compare(password, hashToCompare);

        const accepted = !!user && user.isActive && passwordOk;
        if (!accepted) {
          if (isDev) console.warn("[auth] credentials rejected");
          await audit("auth.login.failure", {
            actorId: user?.id ?? null,
            actorEmail: email,
            metadata: {
              reason: !user
                ? "no_user"
                : !user.isActive
                  ? "inactive"
                  : "bad_password",
            },
          });
          return null;
        }

        // Success → reset the rate-limit bucket for this email.
        clearRate(rateKey);
        await audit("auth.login.success", {
          actorId: user.id,
          actorEmail: user.email,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          image: user.avatarUrl ?? undefined,
        } as any;
      },
    }),
  ],
});
