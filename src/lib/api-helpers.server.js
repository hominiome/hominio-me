import { json } from "@sveltejs/kit";
import { auth } from "$lib/auth.server.js";
import { isAdmin } from "$lib/admin.server";
import { zeroDb } from "$lib/db.server.js";
import { nanoid } from "nanoid";

/**
 * Get authenticated session from request
 * Returns session or null if not authenticated
 */
export async function getSession(request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });
  return session;
}

/**
 * Require authentication - throws 401 if not authenticated
 * Returns session.user if authenticated
 */
export async function requireAuth(request) {
  const session = await getSession(request);
  if (!session?.user?.id) {
    throw json({ error: "Unauthorized" }, { status: 401 });
  }
  return session.user;
}

/**
 * Require admin access - throws 403 if not admin
 * Returns session.user if admin
 */
export async function requireAdmin(request) {
  const user = await requireAuth(request);
  if (!isAdmin(user.id)) {
    throw json({ error: "Forbidden: Admin access required" }, { status: 403 });
  }
  return user;
}

/**
 * Check and clean up expired identities for a user
 * This performs "lazy expiration" - removes expired identities when accessed
 * Only hominio identities expire (founder/angel are one-time purchases)
 * @param {string} userId - User ID to check
 * @returns {Promise<void>}
 */
export async function checkAndCleanupExpiredIdentities(userId) {
  const now = new Date().toISOString();

  // Get all user identities with expiration dates
  const identitiesWithExpiration = await zeroDb
    .selectFrom("userIdentities")
    .selectAll()
    .where("userId", "=", userId)
    .where("expiresAt", "is not", null)
    .execute();

  // Check each identity for expiration
  for (const identity of identitiesWithExpiration) {
    if (!identity.expiresAt) continue;

    const expirationDate = new Date(identity.expiresAt);
    const nowDate = new Date();

    // If expired, downgrade hominio to explorer
    if (nowDate >= expirationDate && identity.identityType === "hominio") {
      // Ensure explorer identity exists
      const explorerIdentity = await zeroDb
        .selectFrom("userIdentities")
        .select(["id"])
        .where("userId", "=", userId)
        .where("identityType", "=", "explorer")
        .executeTakeFirst();

      if (!explorerIdentity) {
        // Create explorer identity if it doesn't exist
        const explorerId = nanoid();
        await zeroDb
          .insertInto("userIdentities")
          .values({
            id: explorerId,
            userId,
            identityType: "explorer",
            selectedAt: now,
            upgradedFrom: "hominio",
          })
          .execute();
      }

      // Delete the expired hominio identity
      await zeroDb
        .deleteFrom("userIdentities")
        .where("id", "=", identity.id)
        .execute();
    }
    // Note: Founder/angel identities shouldn't expire (they're one-time purchases)
    // But if they somehow have expiration dates, we could handle them here too
  }
}

/**
 * Require explorer identity - throws 403 if user doesn't have explorer identity
 * Returns session.user if user has explorer identity
 * Note: Admins bypass this check (they don't need explorer identity)
 * Note: This should be called after requireAuth
 * Note: Automatically cleans up expired identities before checking
 */
export async function requireExplorerIdentity(request) {
  const user = await requireAuth(request);

  // Admins don't need explorer identity
  if (isAdmin(user.id)) {
    return user;
  }

  // Check and clean up expired identities before checking explorer identity
  await checkAndCleanupExpiredIdentities(user.id);

  // Check if user has explorer identity (all identities are universal)
  const explorerIdentity = await zeroDb
    .selectFrom("userIdentities")
    .select(["id"])
    .where("userId", "=", user.id)
    .where("identityType", "=", "explorer")
    .executeTakeFirst();

  if (!explorerIdentity) {
    throw json(
      { error: "Forbidden: Explorer identity required" },
      { status: 403 }
    );
  }

  return user;
}
