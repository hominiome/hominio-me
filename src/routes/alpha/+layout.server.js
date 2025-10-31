import { redirect } from "@sveltejs/kit";
import { auth } from "$lib/auth.server.js";

export async function load({ request, url }) {
  // Get session from better-auth
  const session = await auth.api.getSession({ headers: request.headers });

  // Public routes (no auth required)
  const publicRoutes = ["/alpha", "/alpha/signup"];
  const isPublicRoute = publicRoutes.includes(url.pathname);

  // Protected routes require login
  if (!session?.user && !isPublicRoute) {
    throw redirect(303, "/alpha/signup");
  }

  // If logged in and on signup page, redirect to profile
  if (session?.user && url.pathname === "/alpha/signup") {
    throw redirect(303, "/alpha/me");
  }

  // Pass session to all child routes
  return {
    session: session?.user || null,
  };
}

