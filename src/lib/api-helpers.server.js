import { json } from "@sveltejs/kit";
import { auth } from "$lib/auth.server.js";
import { isAdmin } from "$lib/admin.server";

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

