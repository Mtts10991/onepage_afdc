import { z } from "zod";

/**
 * Password policy used everywhere a user can set/change a password:
 *  - new-user creation in /api/users
 *  - password change in /api/profile/password
 *
 * NIST SP 800-63B recommends length over arbitrary character-class rules,
 * but for a government-facing app we keep the conventional 3-class rule
 * with a generous min-length of 8.
 *
 * The error codes are stable strings (not localized) — callers map them
 * to i18n messages.
 */
export const passwordSchema = z
  .string()
  .min(8, { message: "too_short" })
  .max(128, { message: "too_long" })
  .refine((s) => /[a-z]/.test(s), { message: "missing_lowercase" })
  .refine((s) => /[A-Z]/.test(s), { message: "missing_uppercase" })
  .refine((s) => /[0-9]/.test(s), { message: "missing_digit" });

/**
 * Format zod issues from `passwordSchema` into a single message string —
 * useful for the toast/error display when the API rejects a password.
 */
export function firstPasswordError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "invalid";
}
