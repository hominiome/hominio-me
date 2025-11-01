import { error } from "@sveltejs/kit";
import { authDb } from "$lib/db.server.js";

export async function load({ params }) {
  const { userId } = params;

  if (!userId) {
    throw error(400, "User ID is required");
  }

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

    // Return only public fields (name and image)
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
    console.error("Error fetching user profile:", err);
    throw error(500, "Failed to fetch user profile");
  }
}


