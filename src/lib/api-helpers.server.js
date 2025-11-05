import { json } from "@sveltejs/kit";
import { auth } from "$lib/auth.server.js";
import { isAdmin } from "$lib/admin.server";
import { zeroDb } from "$lib/db.server.js";

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
 * Require explorer identity - throws 403 if user doesn't have explorer identity
 * Returns session.user if user has explorer identity
 * Note: Admins bypass this check (they don't need explorer identity)
 * Note: This should be called after requireAuth
 */
export async function requireExplorerIdentity(request) {
  const user = await requireAuth(request);
  
  // Admins don't need explorer identity
  if (isAdmin(user.id)) {
    return user;
  }
  
  // Check if user has explorer identity (universal, cupId is null)
  const explorerIdentity = await zeroDb
    .selectFrom("userIdentities")
    .select(["id"])
    .where("userId", "=", user.id)
    .where("identityType", "=", "explorer")
    .where("cupId", "is", null)
    .executeTakeFirst();

  if (!explorerIdentity) {
    throw json({ error: "Forbidden: Explorer identity required" }, { status: 403 });
  }

  return user;
}

