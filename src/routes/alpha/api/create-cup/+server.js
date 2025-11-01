import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require admin access (throws 401/403 if not authenticated/admin)
  await requireAdmin(request);

  const { name, description, creatorId } = await request.json();

  if (!name || !creatorId) {
    return json(
      { error: "Cup name and creator ID are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const cupId = nanoid();

  try {
    // Create a wallet for the cup (for future prize pool functionality)
    const walletId = nanoid();
    await zeroDb
      .insertInto("wallet")
      .values({
        id: walletId,
        entityType: "cup",
        entityId: cupId,
        balance: 0,
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    // Create cup directly in database
    await zeroDb
      .insertInto("cup")
      .values({
        id: cupId,
        name: name.trim(),
        description: (description || "").trim(),
        creatorId,
        walletId,
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

