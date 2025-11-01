import { json } from "@sveltejs/kit";
import { authDb } from "$lib/db.server.js";

/**
 * Public API endpoint to get user profile (name and image only)
 * Email and other sensitive fields are NOT exposed
 *
 * GET /alpha/api/user/[userId]
 * Returns: { id, name, image }
 */
export async function GET({ params }) {
  try {
    const { userId } = params;

    if (!userId) {
      return json({ error: "User ID is required" }, { status: 400 });
    }

    // Get user from auth database
    const user = await authDb
      .selectFrom("user")
      .select(["id", "name", "image"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!user) {
      return json({ error: "User not found" }, { status: 404 });
    }

    // Return only public fields (name and image)
    // Email and other sensitive information is NOT included
    return json({
      id: user.id,
      name: user.name,
      image: user.image,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return json({ error: "Failed to fetch user profile" }, { status: 500 });
  }
}

