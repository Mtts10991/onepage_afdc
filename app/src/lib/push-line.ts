import { audit } from "@/lib/audit";

/**
 * Minimal LINE Messaging API push helper.
 *
 * Design rules (locked in PRD):
 * - PDPA: NEVER ship onepage content in the message body. Send a short
 *   action sentence + a deep link back into the app, never the doc body.
 * - Fire-and-forget feel: every call wraps push in try/catch + audit so
 *   a failed LINE push never breaks the user-facing request that
 *   triggered it. Returns boolean success.
 * - Feature-flagged: if `LINE_CHANNEL_ACCESS_TOKEN` is unset (most dev
 *   environments) `pushLineMessage` short-circuits to a no-op and logs
 *   a single audit row, so notification triggers can be wired into
 *   prod-bound code paths long before the OA is provisioned.
 */

export interface PushLineMessageInput {
  /** OA-scoped userId — User.lineBotUserId */
  to: string;
  /** One-line action sentence in Thai (no doc body, no PII). */
  text: string;
  /** Deep link back into the app (e.g. https://app/onepages/<id>). */
  url?: string;
  /** Stable code used by metrics + dedupe later (e.g. "publish", "deadline_24h"). */
  reason: string;
  /** Optional actor/target attribution for the audit row. */
  actorId?: string | null;
  targetId?: string | null;
}

const LINE_PUSH_ENDPOINT = "https://api.line.me/v2/bot/message/push";
const MAX_TEXT_LEN = 500;

export async function pushLineMessage(input: PushLineMessageInput): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    // Skipped — dashboard counts skipped notifications too so we can
    // tell "not configured" apart from "delivered" during pilot.
    await audit("line.notify.skipped", {
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      metadata: { reason: input.reason, cause: "no_token" },
    });
    return false;
  }

  // Compose the body. We deliberately strip any newlines from `text` so a
  // template accident can't inject extra LINE bubbles, and clip length so
  // a long title can't push the message into LINE's 5000-char cap.
  const safeText = input.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LEN);
  const messages: Array<Record<string, unknown>> = [
    { type: "text", text: safeText },
  ];
  if (input.url) {
    messages.push({ type: "text", text: input.url });
  }

  try {
    const res = await fetch(LINE_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: input.to, messages }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      await audit("line.notify.failure", {
        actorId: input.actorId ?? null,
        targetId: input.targetId ?? null,
        metadata: {
          reason: input.reason,
          status: res.status,
          // truncate to keep AuditLog rows small
          response: body.slice(0, 200),
        },
      });
      return false;
    }
    await audit("line.notify.success", {
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      metadata: { reason: input.reason },
    });
    return true;
  } catch (err) {
    await audit("line.notify.failure", {
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      metadata: {
        reason: input.reason,
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
    return false;
  }
}

/**
 * Build the user-facing deep link for a onepage. Reads NEXTAUTH_URL or
 * falls back to a relative path (which LINE will display verbatim).
 */
export function buildOnePageUrl(onepageId: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/onepages/${onepageId}`;
}
