import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
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
    // Get cup to determine size and first round
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

    const cupSize = cup.size || 16;

    // Parse current selected project IDs
    let selectedProjectIds = [];
    try {
      selectedProjectIds = cup.selectedProjectIds
        ? JSON.parse(cup.selectedProjectIds)
        : [];
    } catch (e) {
      selectedProjectIds = [];
    }

    // Check if we're at the limit
    if (selectedProjectIds.length >= cupSize) {
      return json(
        { error: `Cannot add more than ${cupSize} projects` },
        { status: 400 }
      );
    }

    // Check if project is already in cup
    if (selectedProjectIds.includes(projectId)) {
      return json({ error: "Project is already in the cup" }, { status: 400 });
    }

    // Add project to selected list
    selectedProjectIds.push(projectId);

    // Update cup with new selected projects list
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
      message: "Project added to cup successfully",
    });
  } catch (error) {
    console.error("Add project to cup error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to add project to cup",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}
