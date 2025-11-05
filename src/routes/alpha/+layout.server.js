import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/auth.server.js";
import { zeroDb } from "$lib/db.server.js";
import { isAdmin } from "$lib/admin.server";

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
    // Check if user has explorer identity (universal, cupId is null)
    const explorerIdentity = await zeroDb
      .selectFrom("userIdentities")
      .select(["id"])
      .where("userId", "=", session.user.id)
      .where("identityType", "=", "explorer")
      .where("cupId", "is", null)
      .executeTakeFirst();

    // If no explorer identity, redirect to invite modal
    // Exception: allow access to /alpha/me (profile settings), invite route (admin-only), and onboard-user API
    const isMeRoute = url.pathname === "/alpha/me";
    const isInviteRoute = url.pathname.startsWith("/alpha/invite/");
    const isOnboardApi = url.pathname === "/alpha/api/onboard-user";
    
    if (!explorerIdentity && !isMeRoute && !isInviteRoute && !isOnboardApi) {
      // Redirect to /alpha with invite modal - always redirect to ensure modal shows
      // Check if already on /alpha with modal param to avoid redirect loop
      if (url.pathname !== "/alpha" || url.searchParams.get("modal") !== "invite") {
        throw redirect(303, "/alpha?modal=invite");
      }
    }
  }

  // Pass session to all child routes
  return {
    session: session?.user || null,
  };
}

