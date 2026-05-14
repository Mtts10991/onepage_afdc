import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Authorisation primitives for OnePage rows.
 *
 * Visibility / edit rule (single source of truth — every list page,
 * detail page, and API route should reach this helper instead of
 * rolling its own check):
 *
 *   - ADMIN                     → can see + edit + delete *anything*.
 *   - Owner                     → can see + edit + delete their own onepages.
 *   - Same-group teammate       → can see + edit any onepage owned by a user
 *                                  they share at least one Group with.
 *                                  Delete is intentionally NOT granted —
 *                                  destruction stays with owner/admin.
 *   - Everyone else             → no access.
 *
 * Accountability is preserved separately: every edit writes
 * `lastEditedById` / `lastEditedAt` on the OnePage, appends a
 * versioned snapshot with the editor's `authorId`, and emits an
 * `onepage.update` audit event tagged with the cross-owner flag.
 */

export interface SessionUser {
  id: string;
  role?: string | null;
  email?: string | null;
}

/**
 * Fetch the set of user IDs that share at least one group with `userId`.
 * Includes `userId` itself so callers can substitute the result directly
 * into a `where: { ownerId: { in: ids } }` clause without an extra branch.
 *
 * Returns a `Set` for O(1) membership checks on the way back.
 */
export async function getGroupTeammateIds(userId: string): Promise<Set<string>> {
  // One round-trip: pull every membership row for every group the user
  // belongs to, then collapse on the client. The volumes here are tiny
  // (groups = handfuls; members = tens), so this is cheaper than two
  // separate queries with a join.
  const rows = await prisma.groupMembership.findMany({
    where: {
      group: {
        members: { some: { userId } },
      },
    },
    select: { userId: true },
  });
  const ids = new Set<string>(rows.map((r) => r.userId));
  ids.add(userId); // self is always in scope
  return ids;
}

/**
 * Build a Prisma `where` clause that scopes OnePage queries to what the
 * caller is allowed to see / edit. Admins get an unrestricted `{}`.
 *
 * Designed for `findMany` / `count`. For single-row reads, prefer
 * `canAccessOnePage()` below — it makes the access decision explicit and
 * the resulting error code (`forbidden` vs `notfound`) easier to log.
 */
export async function visibleOnePageWhere(
  user: SessionUser,
): Promise<Prisma.OnePageWhereInput> {
  if (user.role === "ADMIN") return {};
  const teammateIds = await getGroupTeammateIds(user.id);
  return { ownerId: { in: Array.from(teammateIds) } };
}

/**
 * Decide what the caller may do with a specific OnePage. Returns:
 *   - `{ ok: true,  canEdit, canDelete, isCrossOwner }` on access
 *   - `{ ok: false }` on no access (caller maps to 403)
 *
 * `isCrossOwner` is true when the caller is editing through group access
 * rather than because they own the row. Routes use this to embellish the
 * audit metadata + the auto-version note so the trail is searchable.
 */
export interface AccessDecision {
  ok: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isCrossOwner: boolean;
}

export async function canAccessOnePage(
  user: SessionUser,
  onepageOwnerId: string,
): Promise<AccessDecision> {
  if (user.role === "ADMIN") {
    return {
      ok: true,
      canEdit: true,
      canDelete: true,
      isCrossOwner: onepageOwnerId !== user.id,
    };
  }
  if (onepageOwnerId === user.id) {
    return { ok: true, canEdit: true, canDelete: true, isCrossOwner: false };
  }
  const teammateIds = await getGroupTeammateIds(user.id);
  if (teammateIds.has(onepageOwnerId)) {
    // Group access — read + edit, but NOT delete.
    return { ok: true, canEdit: true, canDelete: false, isCrossOwner: true };
  }
  return { ok: false, canEdit: false, canDelete: false, isCrossOwner: false };
}
