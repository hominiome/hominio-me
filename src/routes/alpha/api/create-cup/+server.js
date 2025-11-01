import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require authentication (any authenticated user can create cups)
  const session = await getSession(request);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, logoImageUrl, size, creatorId } =
    await request.json();

  if (!name || !creatorId) {
    return json(
      { error: "Cup name and creator ID are required" },
      { status: 400 }
    );
  }

  // Validate size
  const validSizes = [4, 8, 16, 32, 64, 128];
  const cupSize = size || 16; // Default to 16 if not provided
  if (!validSizes.includes(cupSize)) {
    return json(
      { error: `Invalid cup size. Must be one of: ${validSizes.join(", ")}` },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const cupId = nanoid();

  try {
    // Create cup directly in database (no wallet needed)
    await zeroDb
      .insertInto("cup")
      .values({
        id: cupId,
        name: name.trim(),
        description: (description || "").trim(),
        logoImageUrl: (logoImageUrl || "").trim(),
        size: cupSize,
        selectedProjectIds: "[]", // Empty array initially
        creatorId,
        status: "draft",
        currentRound: "",
        winnerId: "",
        createdAt: now,
        startedAt: "",
        completedAt: "",
        updatedAt: now,
      })
      .execute();

    return json({
      success: true,
      cupId,
      message: "Cup created successfully",
    });
  } catch (error) {
    console.error("Create cup error:", error);
    // If error is already a JSON response (from requireAdmin), re-throw it
    if (error && typeof error === "object" && "status" in error) {
      throw error;
    }
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to create cup",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}
