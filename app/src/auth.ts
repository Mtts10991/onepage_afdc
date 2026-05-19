import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Line from "next-auth/providers/line";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clearRate } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { notifyAdminsPendingUser } from "@/lib/notify";
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

/**
 * Resolve the User row a successful LINE OAuth flow should attach to.
 *
 * Policy: self-serve LINE registration is allowed, but new accounts
 * land as `status = "PENDING"`. They can sign in (so they get a session
 * and a profile page where they can add the OA for notifications) but
 * the middleware in `auth.config.ts` bounces them to /pending-approval
 * for everything else. An ADMIN promotes them to `ACTIVE` via
 * /admin/pending-users. Rejection deletes the row.
 *
 * Result shape carries an `isNew` flag the signIn callback uses to
 * decide whether to fan a notification out to admins.
 */
async function resolveLineUser(profile: {
  sub?: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
}): Promise<
  | { ok: true; userId: string; isNew: boolean }
  | { ok: false; reason: string }
> {
  const lineUserId = profile.sub;
  if (!lineUserId) return { ok: false, reason: "no_sub" };

  // Already linked? Return the existing user directly. We look up by
  // (provider, providerAccountId) which is the natural unique key in the
  // NextAuth schema; that index already exists in our Prisma schema.
  const existingLink = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "line",
        providerAccountId: lineUserId,
      },
    },
    select: { userId: true },
  });
  if (existingLink)
    return { ok: true, userId: existingLink.userId, isNew: false };

  // First-time LINE login: must at least have an email (otherwise we
  // can never reconcile this user with any other identity source).
  if (!profile.email) return { ok: false, reason: "no_email_no_link" };

  const userByEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, isActive: true },
  });
  if (userByEmail) {
    if (!userByEmail.isActive) return { ok: false, reason: "inactive" };
    // Re-link case: existing email-provisioned user logs in via LINE for
    // the first time. They keep whatever status they already had.
    return { ok: true, userId: userByEmail.id, isNew: false };
  }

  // Self-serve registration. Land as PENDING and let an admin promote.
  // First-ever user is the bootstrap admin: if the User table is empty,
  // we land as ACTIVE + ADMIN so a fresh deploy isn't locked out waiting
  // for an approver who doesn't exist yet.
  const userCount = await prisma.user.count();
  const isBootstrap = userCount === 0;

  const placeholderHash =
    "$2a$10$.F8U9FusAoPHtKe5efZ9s.6/jXwX/sYDaDYSlx4vIqTWdgiT44Vi2";
  const created = await prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name ?? null,
      avatarUrl: profile.picture ?? null,
      passwordHash: placeholderHash,
      role: isBootstrap ? "ADMIN" : "USER",
      isActive: true,
      status: isBootstrap ? "ACTIVE" : "PENDING",
      registrationSource: "line",
    },
    select: { id: true },
  });
  return { ok: true, userId: created.id, isNew: !isBootstrap };
}

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
          await audit("auth.login.rate_limited", {
            actorEmail: email,
            metadata: { provider: "credentials" },
          });
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
              provider: "credentials",
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
          metadata: { provider: "credentials" },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          status: user.status,
          image: user.avatarUrl ?? undefined,
        } as any;
      },
    }),
    Line({
      // OIDC scope `openid profile email` is requested by default for the
      // LINE provider; the `email` claim only arrives when the channel
      // has the email-address permission approved in the LINE console.
      //
      // `checks: ["state", "pkce"]` — LINE rejects the authorization
      // request with `INVALID_REQUEST 'state' is not specified` if we
      // only send PKCE. The @auth/core LINE provider default in
      // 0.37.x ships with `pkce` only, so we override here.
      checks: ["state", "pkce"],
      // Map LINE's `sub` to our User.id at login time. We can't materialise
      // a new user here (admin-managed directory), so the `signIn` callback
      // below rejects unrecognised LINE accounts and the user sees a clear
      // error on the login page.
      async profile(profile) {
        const resolution = await resolveLineUser({
          sub: profile.sub,
          email: profile.email,
          name: profile.name ?? null,
          picture: (profile as any).picture ?? null,
        });
        if (!resolution.ok) {
          // Throwing here short-circuits NextAuth and surfaces `Configuration`
          // by default — instead, return a sentinel user the signIn callback
          // will reject. We attach the reason so audit logging can record it.
          return {
            id: `__line_unmatched__:${resolution.reason}`,
            email: profile.email ?? null,
            name: profile.name ?? null,
            image: (profile as any).picture ?? null,
          } as any;
        }
        const u = await prisma.user.findUnique({
          where: { id: resolution.userId },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            avatarUrl: true,
            status: true,
          },
        });
        if (!u || !u.email) {
          return {
            id: `__line_unmatched__:lookup_failed`,
            email: null,
            name: null,
          } as any;
        }
        return {
          id: u.id,
          email: u.email,
          name: u.name ?? u.email,
          role: u.role,
          status: u.status,
          image: u.avatarUrl ?? (profile as any).picture ?? undefined,
        } as any;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (account?.provider !== "line") return true;
      const id = (user as any)?.id as string | undefined;
      if (!id || id.startsWith("__line_unmatched__")) {
        const reason = id?.split(":")[1] ?? "unknown";
        await audit("auth.login.failure", {
          actorEmail: (profile as any)?.email ?? null,
          metadata: { provider: "line", reason },
        });
        // Returning the string redirects with `?error=<msg>` on the login
        // page — we use a stable code the UI can translate.
        return `/login?error=line_${reason}`;
      }

      // Defence-in-depth: profile() runs before signIn() so a race or a
      // misconfigured provider could in principle hand us an id that no
      // longer exists. Confirm the row before we let pieces of the
      // upsert below explode on a foreign-key violation (which would
      // surface to the user as the unhelpful "AccessDenied").
      const row = await prisma.user.findUnique({
        where: { id },
        select: { id: true, status: true, email: true },
      });
      if (!row) {
        await audit("auth.login.failure", {
          actorEmail: (user as any).email ?? null,
          metadata: { provider: "line", reason: "user_not_found_post_profile" },
        });
        return `/login?error=line_unknown`;
      }

      // Persist (or refresh) the Account row so subsequent logins by the
      // same LINE identity skip the email lookup. We store only what's
      // needed to recognise the LINE identity again — no access token
      // beyond the session, no refresh token (we have no Notify use yet).
      const lineSub = (profile as any)?.sub as string | undefined;
      let isNewLink = false;
      if (lineSub) {
        const existing = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "line",
              providerAccountId: lineSub,
            },
          },
          select: { id: true },
        });
        isNewLink = !existing;
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "line",
              providerAccountId: lineSub,
            },
          },
          create: {
            userId: id,
            type: "oauth",
            provider: "line",
            providerAccountId: lineSub,
          },
          update: { userId: id },
        });
        if (isNewLink) {
          await audit("auth.line.linked", {
            actorId: id,
            actorEmail: (user as any).email ?? null,
          });
        }
      }

      // If this is a brand-new PENDING registration (a self-serve LINE
      // signup that just created its User row), fan a notification out
      // to every admin who has the LINE OA linked so they don't have to
      // poll /admin/pending-users.
      if (row.status === "PENDING" && isNewLink) {
        await audit("auth.line.registered", {
          actorId: id,
          actorEmail: row.email,
          metadata: { provider: "line" },
        });
        // Fire-and-forget — admin notification failure should never
        // block the user's session from being created.
        await notifyAdminsPendingUser({
          pendingUserEmail: row.email,
          pendingUserName: (user as any).name ?? null,
        });
      }

      await audit("auth.login.success", {
        actorId: id,
        actorEmail: (user as any).email ?? null,
        metadata: { provider: "line", status: row.status },
      });
      return true;
    },
  },
});
