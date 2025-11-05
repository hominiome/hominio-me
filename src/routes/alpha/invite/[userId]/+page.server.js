import { error } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { authDb } from "$lib/db.server.js";

export async function load({ request, params }) {
  const { userId } = params;

  if (!userId) {
    throw error(400, "User ID is required");
  }

  // Require admin access
  await requireAdmin(request);

  try {
    // Get user from auth database
    const user = await authDb
      .selectFrom("user")
      .select(["id", "name", "image"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!user) {
      throw error(404, "User not found");
    }

    // Return user data for onboarding
    return {
      user: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    };
  } catch (err) {
    // If it's already a SvelteKit error, re-throw it
    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }
    console.error("Error fetching user for onboarding:", err);
    throw error(500, "Failed to fetch user data");
  }
}

