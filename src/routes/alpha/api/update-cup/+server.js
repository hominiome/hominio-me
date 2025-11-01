import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { isAdmin } from "$lib/admin.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  const { cupId, name, description, logoImageUrl } = await request.json();

  if (!cupId || !name) {
    return json({ error: "Cup ID and name are required" }, { status: 400 });
  }

  try {
    // Get session
    const session = await getSession(request);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the cup to check ownership
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (!cup) {
      return json({ error: "Cup not found" }, { status: 404 });
    }

    // Check if user is admin or creator
    const userIsAdmin = isAdmin(session.user.id);
    const isCreator = cup.creatorId === session.user.id;

    if (!userIsAdmin && !isCreator) {
      return json({ error: "Forbidden: You can only edit your own cups" }, { status: 403 });
    }

    // Update cup
    await zeroDb
      .updateTable("cup")
      .set({
        name: name.trim(),
        description: (description || "").trim(),
        logoImageUrl: (logoImageUrl || "").trim(),
        updatedAt: new Date().toISOString(),
      })
      .where("id", "=", cupId)
      .execute();

    return json({
      success: true,
      message: "Cup updated successfully",
    });
  } catch (error) {
    console.error("Update cup error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return json({
      error: "Failed to update cup",
      details: errorMessage
    }, { status: 500 });
  }
}

