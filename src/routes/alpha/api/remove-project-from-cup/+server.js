import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require admin access
  await requireAdmin(request);

  const { cupId, projectId } = await request.json();

  if (!cupId || !projectId) {
    return json(
      { error: "Cup ID and project ID are required" },
      { status: 400 }
    );
  }

  try {
    // Get cup to determine first round
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (!cup) {
      return json({ error: "Cup not found" }, { status: 404 });
    }

    if (cup.status !== "draft") {
      return json(
        { error: "Cannot modify projects in active or completed cups" },
        { status: 400 }
      );
    }

    // Parse current selected project IDs
    let selectedProjectIds = [];
    try {
      selectedProjectIds = cup.selectedProjectIds
        ? JSON.parse(cup.selectedProjectIds)
        : [];
    } catch (e) {
      selectedProjectIds = [];
    }

    // Remove project from selected list
    selectedProjectIds = selectedProjectIds.filter((id) => id !== projectId);

    // Update cup with updated selected projects list
    await zeroDb
      .updateTable("cup")
      .set({
        selectedProjectIds: JSON.stringify(selectedProjectIds),
        updatedAt: new Date().toISOString(),
      })
      .where("id", "=", cupId)
      .execute();

    return json({
      success: true,
      message: "Project removed from cup successfully",
    });
  } catch (error) {
    console.error("Remove project from cup error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove project from cup",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}
