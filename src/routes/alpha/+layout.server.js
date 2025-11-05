import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/auth.server.js";
import { zeroDb } from "$lib/db.server.js";
import { isAdmin } from "$lib/admin.server";
import { checkAndCleanupExpiredIdentities } from "$lib/api-helpers.server.js";

export async function load({ request, url }) {
  // Get session from better-auth
  const session = await auth.api.getSession({ headers: request.headers });

  // Public routes (no auth required) - none, redirect to /signin
  const publicRoutes = [];
  const isPublicRoute = publicRoutes.includes(url.pathname);

  // Protected routes require login - redirect to /signin
  if (!session?.user && !isPublicRoute) {
    throw redirect(303, "/signin");
  }

  // Gatekeeping: Check explorer identity for logged-in users on all routes
  // Admins bypass this check (they don't need explorer identity)
  // Exception: allow access to /alpha/me for profile settings
  if (session?.user && !isPublicRoute && !isAdmin(session.user.id)) {
    // Check and clean up expired identities before checking explorer identity
    await checkAndCleanupExpiredIdentities(session.user.id);
    
    // Check if user has explorer identity (all identities are universal)
    const explorerIdentity = await zeroDb
      .selectFrom("userIdentities")
      .select(["id"])
      .where("userId", "=", session.user.id)
      .where("identityType", "=", "explorer")
      .executeTakeFirst();

    // If no explorer identity, redirect to invite modal
    // Exception: allow access to /alpha/me (profile settings), invite route (admin-only), public API endpoints, and onboard-user API
    const isMeRoute = url.pathname === "/alpha/me";
    const isInviteRoute = url.pathname.startsWith("/alpha/invite/");
    const isOnboardApi = url.pathname === "/alpha/api/onboard-user";
    const isPublicApi = url.pathname.startsWith("/alpha/api/user/"); // Public user profile API
    
    // Skip explorer identity check for API routes (they handle their own auth)
    const isApiRoute = url.pathname.startsWith("/alpha/api/");
    
    if (!explorerIdentity && !isMeRoute && !isInviteRoute && !isOnboardApi && !isPublicApi && !isApiRoute) {
      // Redirect to /alpha/me - invite logic is now in profile page
      if (url.pathname !== "/alpha/me") {
        throw redirect(303, "/alpha/me");
      }
    }
  }

  // Pass session to all child routes
  return {
    session: session?.user || null,
  };
}

