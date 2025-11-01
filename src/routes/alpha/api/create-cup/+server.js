import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { getOrCreateWallet } from "$lib/services/walletService.js";

export async function POST({ request }) {
  // Require authentication (any authenticated user can create cups)
  const session = await getSession(request);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description, logoImageUrl, creatorId } = await request.json();

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
    const cupWallet = await getOrCreateWallet(zeroDb, "cup", cupId);

    // Create cup directly in database
    await zeroDb
      .insertInto("cup")
      .values({
        id: cupId,
        name: name.trim(),
        description: (description || "").trim(),
        logoImageUrl: (logoImageUrl || "").trim(),
        creatorId,
        walletId: cupWallet.id,
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

