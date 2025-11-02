import { error } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";

export async function load({ request }) {
  // Check if user is admin
  try {
    await requireAdmin(request);
    return {};
  } catch (err) {
    // If not admin, redirect will happen client-side
    throw error(403, "Admin access required");
  }
}

