import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/**
 * LINE Messaging API webhook receiver.
 *
 * We use this single endpoint for two things:
 *   1. `follow` events — a user added the OA as a friend; we save their
 *      bot-scoped userId onto `User.lineBotUserId` so future deadline /
 *      publish pushes can reach them.
 *   2. `unfollow` events — the user blocked or removed the OA; we drop
 *      `lineBotUserId` so we never try to push to a dead conduit.
 *
 * Identifying which app user this LINE userId belongs to: we look up
 * via the existing `Account` row (provider="line", providerAccountId=
 * <LINE Login sub>). For this to work the user must have already signed
 * in with LINE once (M2), which is also the natural onboarding order
 * we surface in the profile UI. If no Account match is found we record
 * an audit row and ignore — there is no app-side user to attach the
 * push conduit to.
 *
 * Signature verification follows LINE's documented HMAC-SHA256 scheme.
 */

const TIMING_SAFE_EQ_LEN = 64; // base64-encoded SHA-256 is 44 chars; pad short ones.

function verifySignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64");
  // Equalise lengths to keep `timingSafeEqual` happy.
  const a = Buffer.from(signature.padEnd(TIMING_SAFE_EQ_LEN, "="));
  const b = Buffer.from(expected.padEnd(TIMING_SAFE_EQ_LEN, "="));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface LineWebhookEvent {
  type: string;
  source?: { userId?: string };
  // LINE sends more fields than we use; only declare the ones we read.
}

export async function POST(req: NextRequest) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    // Feature off — accept the call so the LINE console "verify" check
    // doesn't fail loudly, but record it so ops can spot misconfig.
    await audit("line.webhook.skipped", { metadata: { cause: "no_secret" } });
    return new NextResponse(null, { status: 200 });
  }

  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!verifySignature(raw, sig, secret)) {
    await audit("line.webhook.rejected", { metadata: { cause: "bad_signature" } });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let parsed: { events?: LineWebhookEvent[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  for (const event of parsed.events ?? []) {
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    if (event.type === "follow") {
      // Find which app user this LINE identity belongs to via the M2 link.
      const account = await prisma.account.findFirst({
        where: { provider: "line", providerAccountId: lineUserId },
        select: { userId: true },
      });
      if (!account) {
        await audit("line.notify.optin_orphan", {
          metadata: { lineUserId },
        });
        continue;
      }
      await prisma.user.update({
        where: { id: account.userId },
        data: { lineBotUserId: lineUserId },
      });
      await audit("line.notify.opted_in", {
        actorId: account.userId,
        metadata: { lineUserId },
      });
    } else if (event.type === "unfollow") {
      const u = await prisma.user.findUnique({
        where: { lineBotUserId: lineUserId },
        select: { id: true },
      });
      if (!u) continue;
      await prisma.user.update({
        where: { id: u.id },
        data: { lineBotUserId: null },
      });
      await audit("line.notify.opted_out", {
        actorId: u.id,
        metadata: { lineUserId },
      });
    }
    // Ignore message/postback/etc. — we don't run a chatbot.
  }

  return new NextResponse(null, { status: 200 });
}
