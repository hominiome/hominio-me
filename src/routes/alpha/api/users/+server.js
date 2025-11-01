import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { authDb } from "$lib/db.server.js";

/**
 * Admin-only API endpoint to search/list users
 * GET /alpha/api/users?query=searchTerm
 * Returns: Array of { id, name, image }
 */
export async function GET({ request, url }) {
  // Require admin access
  await requireAdmin(request);

  try {
    const query = url.searchParams.get("query") || "";

    // Build query - search by name if query provided
    let dbQuery = authDb
      .selectFrom("user")
      .select(["id", "name", "image"])
      .orderBy("name", "asc")
      .limit(50); // Limit results

    // If query provided, filter by name (case-insensitive)
    if (query.trim()) {
      dbQuery = dbQuery.where("name", "ilike", `%${query.trim()}%`);
    }

    const users = await dbQuery.execute();

    // Return only public fields (id, name, image)
    return json(
      users.map((user) => ({
        id: user.id,
        name: user.name,
        image: user.image,
      }))
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

