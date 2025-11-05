import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require admin access
  await requireAdmin(request);

  try {
    const { userId } = await request.json();

    if (!userId) {
      return json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if user already has explorer identity
    const existingExplorer = await zeroDb
      .selectFrom("userIdentities")
      .select(["id"])
      .where("userId", "=", userId)
      .where("identityType", "=", "explorer")
      .where("cupId", "is", null)
      .executeTakeFirst();

    if (existingExplorer) {
      return json({ 
        error: "User already has explorer identity",
        alreadyOnboarded: true 
      }, { status: 400 });
    }

    // Create explorer identity
    const identityId = nanoid();
    const now = new Date().toISOString();

    await zeroDb
      .insertInto("userIdentities")
      .values({
        id: identityId,
        userId,
        cupId: null, // Universal identity
        identityType: "explorer",
        votingWeight: 0, // No voting rights
        selectedAt: now,
        upgradedFrom: null,
      })
      .execute();

    return json({
      success: true,
      message: "User successfully onboarded as explorer",
      identity: {
        id: identityId,
        userId,
        identityType: "explorer",
        votingWeight: 0,
      },
    });
  } catch (error) {
    console.error("Error onboarding user:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to onboard user" },
      { status: 500 }
    );
  }
}

