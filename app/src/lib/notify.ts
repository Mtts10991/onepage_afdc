import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { buildOnePageUrl, pushLineMessage } from "@/lib/push-line";

/**
 * Domain-level "notify the owner of this onepage" wrappers. Always look up
 * `lineBotUserId` on the OWNER (not the actor) since the owner is the
 * person who needs to know their doc was touched. We never include doc
 * content in the message body — PDPA constraint baked in by `push-line`.
 *
 * All helpers are fire-and-forget: callers should await but failures
 * never escape (the helper records its own audit row).
 */

export async function notifyOnePagePublished(
  onepageId: string,
  actorId: string | null,
): Promise<void> {
  const op = await prisma.onePage.findUnique({
    where: { id: onepageId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { lineBotUserId: true } },
    },
  });
  if (!op?.owner?.lineBotUserId) {
    // Owner hasn't opted in (no LINE bot link) — nothing to do.
    await audit("line.notify.no_target", {
      actorId,
      targetId: onepageId,
      metadata: { reason: "publish" },
    });
    return;
  }
  // Skip self-notifications (owner publishing their own doc is unsurprising)
  if (actorId === op.ownerId) return;

  await pushLineMessage({
    to: op.owner.lineBotUserId,
    text: `เอกสาร "${op.title}" ของคุณถูกเผยแพร่ (export) แล้ว`,
    url: buildOnePageUrl(op.id),
    reason: "publish",
    actorId,
    targetId: op.id,
  });
}

export async function notifyOnePageCrossEdited(
  onepageId: string,
  actorId: string,
  actorEmail: string | null,
): Promise<void> {
  const op = await prisma.onePage.findUnique({
    where: { id: onepageId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { lineBotUserId: true } },
    },
  });
  if (!op?.owner?.lineBotUserId) {
    await audit("line.notify.no_target", {
      actorId,
      targetId: onepageId,
      metadata: { reason: "cross_edit" },
    });
    return;
  }
  if (actorId === op.ownerId) return;

  // The actor email is intentionally included — owner needs to know WHO
  // edited their document. Email is not "doc content"; it's an identifier
  // the owner already has via the directory.
  const who = actorEmail ?? "เพื่อนในกลุ่ม";
  await pushLineMessage({
    to: op.owner.lineBotUserId,
    text: `${who} แก้ไขเอกสาร "${op.title}" ของคุณ`,
    url: buildOnePageUrl(op.id),
    reason: "cross_edit",
    actorId,
    targetId: op.id,
  });
}

/**
 * Push a notice to every active admin who has linked LINE notifications.
 * Used when a new self-serve registration needs human review — the
 * dashboard badge is necessary but not sufficient, admins shouldn't
 * have to keep refreshing /admin/pending-users to find work.
 */
export async function notifyAdminsPendingUser(args: {
  pendingUserEmail: string;
  pendingUserName: string | null;
}): Promise<void> {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
      status: "ACTIVE",
      lineBotUserId: { not: null },
    },
    select: { id: true, lineBotUserId: true },
  });
  if (admins.length === 0) {
    await audit("line.notify.no_target", {
      metadata: { reason: "pending_user_no_admin_target" },
    });
    return;
  }
  const who = args.pendingUserName ?? args.pendingUserEmail;
  const url = `${(process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "")}/admin/pending-users`;
  await Promise.all(
    admins.map((a) =>
      a.lineBotUserId
        ? pushLineMessage({
            to: a.lineBotUserId,
            text: `มีผู้สมัครใหม่ "${who}" รออนุมัติ`,
            url,
            reason: "pending_user",
            actorId: a.id,
          })
        : Promise.resolve(false),
    ),
  );
}

/**
 * Notify a user that their pending registration was just approved.
 */
export async function notifyUserApproved(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, lineBotUserId: true },
  });
  if (!u?.lineBotUserId) return;
  const url = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "") || "/";
  await pushLineMessage({
    to: u.lineBotUserId,
    text: "บัญชีของคุณได้รับการอนุมัติแล้ว ใช้งานระบบ One Page ได้ทันที",
    url,
    reason: "approved",
    actorId: u.id,
    targetId: u.id,
  });
}

export async function notifyOnePageDeadlineDue(
  onepageId: string,
): Promise<void> {
  const op = await prisma.onePage.findUnique({
    where: { id: onepageId },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { lineBotUserId: true } },
    },
  });
  if (!op?.owner?.lineBotUserId) {
    await audit("line.notify.no_target", {
      targetId: onepageId,
      metadata: { reason: "deadline_24h" },
    });
    return;
  }
  await pushLineMessage({
    to: op.owner.lineBotUserId,
    text: `แผน "${op.title}" จะถึงกำหนดภายใน 24 ชั่วโมง`,
    url: buildOnePageUrl(op.id),
    reason: "deadline_24h",
    actorId: op.ownerId,
    targetId: op.id,
  });
}
