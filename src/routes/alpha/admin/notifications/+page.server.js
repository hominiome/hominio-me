import { redirect } from "@sveltejs/kit";
import { isAdmin } from "$lib/admin.server";
import { auth } from "$lib/auth.server.js";

/**
 * Server-side load function to verify admin access
 */
export async function load({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    throw redirect(303, "/signin");
  }

  if (!isAdmin(session.user.id)) {
    throw redirect(303, "/alpha");
  }

  return {
    user: session.user,
  };
}

