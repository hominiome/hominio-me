import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { nanoid } from "nanoid";

export async function POST({ request }) {
  try {
    // Authenticate user
    const user = await requireAuth(request);

    // Parse request body
    const { subscribe } = await request.json();

    if (typeof subscribe !== "boolean") {
      return json({ error: "subscribe must be a boolean" }, { status: 400 });
    }

    // Explicitly set subscription value (not a toggle)
    // subscribe === true means "Yes" - set to subscribed
    // subscribe === false means "No" - set to not subscribed
    const subscriptionValue = subscribe ? "true" : "false";

    // Check if user preferences already exist
    const existingPrefs = await zeroDb
      .selectFrom("userPreferences")
      .select(["id"])
      .where("userId", "=", user.id)
      .executeTakeFirst();

    const now = new Date().toISOString();

    if (existingPrefs) {
      // Update existing preferences - explicitly set the value
      await zeroDb
        .updateTable("userPreferences")
        .set({
          newsletterSubscribed: subscriptionValue,
          updatedAt: now,
        })
        .where("id", "=", existingPrefs.id)
        .execute();
    } else {
      // Create new preferences - explicitly set the value
      await zeroDb
        .insertInto("userPreferences")
        .values({
          id: nanoid(),
          userId: user.id,
          newsletterSubscribed: subscriptionValue,
          updatedAt: now,
        })
        .execute();
    }

    return json({
      success: true,
      message: `Newsletter subscription ${subscribe ? "enabled" : "disabled"}`,
    });
  } catch (error) {
    console.error("Failed to toggle newsletter:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to toggle newsletter",
      },
      { status: 500 }
    );
  }
}

